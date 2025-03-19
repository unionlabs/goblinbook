# ANCHOR: sdk-flake-nix
# ANCHOR: swaps-flake-nix
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
            # ANCHOR_END: swaps-flake-nix
            pkgs.nodejs # Node.js for JavaScript/TypeScript runtime
            pkgs.nodePackages.typescript # TypeScript compiler (tsc)
            pkgs.nodePackages.ts-node
            # ANCHOR: swaps-flake-nix-tail
          ];
        };
      }
    );
}
# ANCHOR_END: swaps-flake-nix-tail
# ANCHOR_END: sdk-flake-nix
