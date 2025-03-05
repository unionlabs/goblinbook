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

            pkgs.graphqurl
          ];
        };
      }
    );
}