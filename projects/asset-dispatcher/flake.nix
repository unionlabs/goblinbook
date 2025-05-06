{
  description = "Example Union TypeScript SDK usage";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{ flake-parts, nixpkgs, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      perSystem =
        {
          config,
          self',
          inputs',
          pkgs,
          lib,
          system,
          ...
        }:
        let
          denortPerSystem = {
            "aarch64-darwin" = {
              target = "aarch64-apple-darwin";
              sha256 = lib.fakeHash;
            };
            "aarch64-linux" = {
              target = "aarch64-unknown-linux-gnu";
              sha256 = lib.fakeHash;
            };
            "x86_64-darwin" = {
              target = "x86_64-apple-darwin";
              sha256 = lib.fakeHash;
            };
            "x86_64-linux" = {
              target = "x86_64-unknown-linux-gnu";
              sha256 = "sha256-7reSKyqBLw47HLK5AdgqL1+qW+yRP98xljtcnp69sw4=";
            };
          }.${system};
          platform = builtins.trace "Using platform: ${denortPerSystem.target}" denortPerSystem.target;
          packageJson = lib.importJSON ./package.json;
          pnpm = pkgs.pnpm;
          deno = pkgs.deno;
          denort = pkgs.fetchzip {
            url = "https://dl.deno.land/release/v${deno.version}/denort-${platform}.zip";
            sha256 = denortPerSystem.sha256;
            stripRoot = false;
          };
        in
        {
          packages = {
            default = pkgs.buildNpmPackage rec {
              pname = packageJson.name;
              inherit (packageJson) version;
              src = ./.;
              npmConfigHook = pnpm.configHook;
              nativeBuildInputs = [
                deno
              ];
              npmDepsHash = "sha256-aCanKkUwZQdsaNFIojQdLPMko6EGxGStX6TxxCS5pVY=";
              pnpmDeps = pnpm.fetchDeps {
                inherit
                  pname
                  src
                  version
                  ;
                hash = npmDepsHash;
              };
              npmDeps = pnpmDeps;
              doCheck = true;
              checkPhase = ''
                deno check 'src/**/*.ts'
              '';
              buildPhase = ''
                runHook preBuild
                DENORT_BIN=${denort}/denort deno compile --no-remote --output out src/index.ts
                runHook postBuild
              '';
              installPhase = ''
                mkdir -p $out
                cp ./out $out
              '';
              doDist = false;
            };
          };

          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs
              pnpm
              deno
              #nodePackages_latest.typescript-language-server
              biome
              nixfmt
            ];
          };
        };
    };
}
