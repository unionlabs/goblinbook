# Addresses

One would think that addresses would be resolved by now and chains would have uniform handling of this by now. That is not the case at all.

For a formal specification of how Union handles addresses, check the [docs](https://docs.union.build/concepts/address-types/).

## TLDR

Cosmos addresses use bech32 encoding with this format:

```
{HRP}1{address}{checksum}
```

The human readable part (hrp) differentiates between chains (like `union` or `stars`). It's followed by the number 1, then the address, and finally a 6 byte checksum.

When querying transfers across multiple chains for address `union1abc...123`, searching for that specific string would miss transfers from the same address on other chains like `stars1abc...xyz`.

Union's SDKs and APIs solve this by supporting searches by:
- `display` style (chain-specific format shown in browsers)
- `canonical` format (without hrp/chain-specific info)

You can query the API to see all versions of an address:

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Command')">Convert Address</button>
  <button class="tablinks" onclick="openTab(event, 'Nix')">Nix</button>
</div>

<div id="Command" class="tabcontent">

```bash
gq https://graphql.union.build/v1/graphql -q '
{
    address_types(display: "union1d03cn520attx29qugxh4wcyqm9r747j64ahcj3") {
       display
       canonical
       zkgm
    }
}
'
```

</div>

<div id="Nix" class="tabcontent">

```bash
nix shell nixpkgs#nodePackages.graphqurl
```

</div>