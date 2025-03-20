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
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
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
          packageJson = lib.importJSON ./package.json;
        in
        {
          packages = {
            default = pkgs.buildNpmPackage {
              pname = packageJson.name;
              inherit (packageJson) version;
              src = ./.;
              npmDepsHash = "sha256-ZN47MDJes95+CXBoPaN4blpxP12ZS6trnUtm0+tYTqo=";

              postInstall = ''
                mkdir -p $out/bin
                cat > $out/bin/${packageJson.name} << EOF
                #!/usr/bin/env node
                require('../lib/node_modules/${packageJson.name}/dist/src/index.js')
                EOF
                chmod +x $out/bin/${packageJson.name}
              '';
            };
          };

          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs
              nodePackages_latest.typescript-language-server
              biome
              nixfmt
            ];
          };
        };
    };
}
