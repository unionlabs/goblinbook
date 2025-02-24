{
  description = "Project Nexus";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    foundry.url = "github:shazow/foundry.nix";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      foundry,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ foundry.overlay ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.foundry-bin # Provides forge, cast, anvil, etc.
            pkgs.nodejs # Node.js for JavaScript/TypeScript runtime
            pkgs.nodePackages.typescript # TypeScript compiler (tsc)
            pkgs.nodePackages.ts-node
          ];
        };
      }
    );
}
