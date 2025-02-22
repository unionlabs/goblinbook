# Nixos

This book heavily leverages Nix in examples to make it easier for you to build and fetch tools used in examples. Get started by [installing Nix](https://docs.determinate.systems/). You do not need to actually learn the Nix language to read this book, although some basic knowledge may help you out.

## Following Along

Whenever we provide code examples for you to execute in your shell, the code snippet will be accompanied by a `Nix` tab. The `Nix` tab shows you the commands necessary to load the tools into your shell for executing that snippet.

For example, here is a snippet to query the Union GraphQL API, which requires `graphqurl` to execute. If you click on the `Nix` tab and copy the lines there, `graphqurl` will be installed in your shell.

Don't worry about bloating your system. Once you close the shell, everything that was installed will be gone again.

Here for example, we show how to query for packets using `gq`.

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Command')">Command</button>
  <button class="tablinks" onclick="openTab(event, 'Nix')">Nix</button>
</div>

<div id="Command" class="tabcontent">

```bash
gq https://graphql.union.build/v1/graphql -q '
{
  v1_ibc_union_packets(limit: 3) {
    packet_hash
    packet_send_block_hash
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

If you decide not to use nix, do not worry. We rely mainly on common, open-source software, that can usually be installed using [npm](https://www.npmjs.com/) or [brew](https://brew.sh/). All examples can still be followed along with alternative installation methods.
