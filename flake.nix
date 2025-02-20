{
  description = "Interop: Principles, Techniques, and Tools";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs =
    inputs@{ flake-parts, treefmt-nix, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ treefmt-nix.flakeModule ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];

      perSystem =
        { pkgs, ... }:
        {
          packages.default = pkgs.stdenv.mkDerivation {
            name = "goblinbook";
            src = ./.;
            buildInputs = with pkgs; [
              mdbook
              mdbook-mermaid
              nodePackages.mermaid-cli
            ];
            buildPhase = ''
              # Find all .md files and process Mermaid diagrams to SVG
              find src -name "*.md" -type f -exec sh -c '
                file="$1"
                echo "Processing $file"
                awk "/^```mermaid$/,/^```$/{p=NR};p&&NR>=p{a[NR]=\$0}p&&/^```$/{
                  print \"Converting diagram to SVG...\"
                  for(i=p+1;i<NR;i++) printf \"%s\\n\", a[i] > \"temp.mmd\"
                  system(\"mmdc -i temp.mmd -o \" substr(\$file,1,length(\$file)-3) NR \".svg\")
                  print \"![Diagram](\" substr(\$file,1,length(\$file)-3) NR \".svg)\"
                  delete a
                  p=0
                }" "$file" > "$file.new"
                mv "$file.new" "$file"
              ' sh {} \;

              mdbook build
            '';
            installPhase = ''
              mkdir -p $out
              cp -r book $out/
            '';
          };

          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              mdbook
              mdbook-mermaid
              nodePackages.mermaid-cli
            ];
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs.nixfmt.enable = pkgs.lib.meta.availableOn pkgs.stdenv.buildPlatform pkgs.nixfmt-rfc-style.compiler;
            programs.nixfmt.package = pkgs.nixfmt-rfc-style;
            programs.mdformat.enable = true;
            programs.prettier.enable = true;
            programs.taplo.enable = true;
          };
        };
    };
}
