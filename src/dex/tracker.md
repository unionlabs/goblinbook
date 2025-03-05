# Historic data

We will want to analyze our orderflow and expose a personal dashboard to our users. For performance reasons, we don't solely want to rely on the Union graphql API, as refetching loads of data is inefficient. Instead we will use build a data warehouse on Postgresql, which we can combine with TimescaleDB and other plugins for advanced analysis.


## Setup

We will be writing our backend and indexer in Rust. Extend the `flake.nix` with various Rust development tools:

```nix
{
  description = "Project Nexus";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    foundry.url = "github:shazow/foundry.nix";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        flake-utils.follows = "flake-utils";
      };
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      foundry,
      rust-overlay,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            foundry.overlay
            rust-overlay.overlays.default
          ];
        };
        
        # Specify your desired Rust version here
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" "clippy" "rustfmt" ];
          targets = [ "wasm32-unknown-unknown" ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Foundry and Node.js tools
            pkgs.foundry-bin # Provides forge, cast, anvil, etc.
            pkgs.nodejs # Node.js for JavaScript/TypeScript runtime
            pkgs.nodePackages.typescript # TypeScript compiler (tsc)
            pkgs.nodePackages.ts-node
            
            # Rust development tools
            rustToolchain
            pkgs.cargo-watch
            pkgs.cargo-expand
            pkgs.cargo-audit
            pkgs.cargo-deny
            
            # Optional: Additional development tools
            pkgs.pkg-config
            pkgs.openssl.dev

            # So we don't need to keep enabling this
            pkgs.graphqurl
          ];
        };
      }
    );
}
```

Let's verify the integrity of our environment

```bash
nix develop
cargo --version
```

Now we're ready to create our backend project. We'll scaffold it with `cargo`.

```bash
cargo new indexer
cd indexer
cargo test
```

We will write our project in the `indexer` directory. We will setup a simple indexer + data warehouse for ingesting and analzing data. Our warehouse of choice is Postgres. 

## Order History

Any good trading tracker should show historic trades. This means that we will want to obtain a stream of all trades going through Nexus, which we can divide by users later on. To be able to filter for our own trades, we need to alter the orders we are submitting to Union, and adding a `Tag`.

```solidity
    // 3. Create fungible asset order instruction

    // Create array of Instructions with size 2
    Instruction[] memory instructions = new Instruction[](2);

    // Populate the first instruction
    instructions[0] = ZkgmLib.makeFungibleAssetOrder(
        FungibleAssetOrder({
            sender: abi.encodePacked(msg.sender),
            receiver: order.receiver,
            baseToken: abi.encodePacked(order.baseToken),
            baseTokenPath: 0,
            baseTokenSymbol: new bytes(0),
            baseTokenName: new bytes(0),
            baseTokenDecimals: 18,
            baseAmount: order.baseAmount,
            quoteToken: order.quoteToken,
            quoteAmount: order.quoteAmount
        })
    );

    // Populate the second instruction
    instructions[1] = ZkgmLib.makeTag(address(this))

    Instruction memory instruction = ZkgmLib.makeBatch(instructions)
```

Now our each of our orders will have our contract address as a tag. This will make it useful to find `Nexus` orders in the stream of other orders.

### Fetching Orders

We will use [`graphql-client`](https://github.com/graphql-rust/graphql-client) to scrape the Union graphql endpoint. 

```bash
cargo add graphql_client
cargo add anyhow
```

Next, we need to fetch the Graphql schema. This will make our queries fully type checked.

```bash
gq https://graphql.union.build/v1/graphql --introspect > schema.graphql
```

Now inside `src`, create a `queries` directory. We will store various graphql queries here.

```bash
mkdir queries
touch queries/fetch-orders.graphql
```

Inside `queries/fetch-orders.graphql`, We will define a query to fetch orders. We need a way to [paginate] our request, so we don't keep indexing the same data. We will use timestamps for this.

```graphql
query FetchOrdersFromTimestamp($from: timestamp!) {
    ...
}
```

Our query has a `from` parameter, which we use to to select for the oldest orders. We will continiously fetch orders, and each time check what the last timestamp was in the returned orders, and use that in the next query.

```rust
async fn fetch_orders_from_timestamp(timestamp: chrono::Datetime) -> anyhow::Result<FetchOrdersFromTimestamp> {
    todo!()
}

fn fetch_orders(start: chrono::Datetime) -> impl Stream() {
    todo!()
}

#[tokio::main]
async fn main(
    fetch_orders(chrono::Datetime::now())
        .inspect(|order| println!("{:?}", order))
        .await;
)
```

This will continously scrape orders. We use a Stream to yield each batch of orders.

### Storing Orders

To store our fetched orders, we will need to connect to a database. For development purposes, we will do a local installation of Postgres.

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Homebrew')">Homebrew</button>
  <button class="tablinks" onclick="openTab(event, 'Apt')">Apt</button>
</div>

<div id="Homebrew" class="tabcontent">

```bash
brew install postgresql
```

</div>

<div id="Apt" class="tabcontent">

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

</div>

Verify that the installation succeeded by running:

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Homebrew')">Homebrew</button>
  <button class="tablinks" onclick="openTab(event, 'Apt')">Apt</button>
</div>

<div id="Homebrew" class="tabcontent">

```bash
brew services list | grep postgresql
```

</div>

<div id="Apt" class="tabcontent">

```bash
sudo systemctl status postgresql
```

</div>

Next we need a driver to connect to the database from our Rust code. The driver will manage the connection and provide us with an easy to use interface. Two popular drivers are [tokio-postgres](https://docs.rs/tokio-postgres/latest/tokio_postgres/) and
[sqlx](https://docs.rs/sqlx/latest/sqlx/). `sqlx` is more feature rich and well suited for larger apps, but for our little project, we will use the leaner `tokio-postgres`. 

```bash
cargo add tokio-postgres
```

Now update the main.rs to create a client. We will also alter the signature of the main function to return `anyhow::Result<()>`. This will allow us to use the `?` operator for error propagation.

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()>
let (client, connection) =
        tokio_postgres::connect("host=localhost user=postgres", NoTls).await?;

// The connection object performs the actual communication with the database,
// so spawn it off to run on its own.
tokio::spawn(async move {
    if let Err(e) = connection.await {
        eprintln!("connection error: {}", e);
    }
});
```

#### Migration Management

Before we insert data into our database, we will need to create tables. We can do this directly, but it is better to have dedicated files and tools managing our migrations. We will use [`refinery`](https://github.com/rust-db/refinery), which has support for `tokio-postgres`.

```bash
cargo add refinery --features tokio-postgres
```

```rust
mod migrations {
    refinery::embed_migrations!("./migrations");
}
```

```
mkdir migrations
touch migrations/
```

Inside the migrations directory, create a file named `V1__initial.sql`. Refinery uses a simple format
[U|V]{1}__{2}.sql or [U|V]{1}__{2}.rs, where {1} represents the migration version and {2} the name.

```sql
CREATE TABLE orders (
    source_address text,
    destination_address text,
    baseToken text,
    baseAmount text,
    quoteToken text,
    quoteAmount text,
    block_timestamp timestamptz,
)
```

### Database Insertions

Right now we fetch orders, and then print the batches. Instead we should do a database insertion:

```rust
    fetch_orders(chrono::Datetime::now())
        .inspect(|order| println!("{:?}", order))
        // add the for_each call to your code.
        for_each(|batch| {
            let rows = client
                .query("INSERT INTO orders () SELECT FROM UNNEST($1::jsonb[])", &[batch])
                .await?;
        })
        .await;
```

We are using `UNNEST` to perform batch inserts into the database, which is very efficient for large volumes of data.
