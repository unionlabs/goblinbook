# goblinbook

A comprehensive guide to understanding and building cross-chain infrastructure. Read the book [here](https://unionlabs.github.io/goblinbook).

## Overview

goblinbook serves as a detailed resource for developers interested in cross-chain development, IBC protocols, and blockchain interoperability. The book covers fundamental concepts, advanced implementations, and best practices for building robust cross-chain applications.

## Features

- In-depth explanations of cross-chain communication protocols
- Practical examples and code snippets
- Step-by-step tutorials for implementing IBC channels
- Security considerations and best practices
- Performance optimization guidelines
- Real-world use cases and implementations

## Getting Started

### Prerequisites

- [Nix](https://nixos.org/download.html) package manager
- Basic understanding of blockchain development
- Familiarity with Rust and/or Solidity

### Installation

1. Clone the repository:

```bash
git clone https://github.com/unionlabs/goblinbook.git
cd goblinbook
```

2. Enter the Nix development environment:

```bash
nix develop
```

3. Start the mdBook server:

```bash
mdbook watch . --open
```

This will launch the book in your default web browser and automatically reload when changes are made.

## Contributing

We welcome contributions from the community! Here's how you can help:

1. Fork the repository
1. Create a new branch for your feature
1. Make your changes
1. Submit a pull request

Please ensure your contributions:

- Follow the existing style and formatting
- Include appropriate documentation
- Add tests where applicable
- Update the table of contents if necessary

## Project Structure

```
goblinbook/
├── src/
│   ├── SUMMARY.md       # Book structure
│   ├── ...              # other chapters
├── book.toml            # mdBook configuration
├── theme/
└── README.md
```

## Building and Testing

To build the book locally:

```bash
mdbook build
```

The output will be available in the `book` directory.

## Acknowledgments

- Contributors and reviewers
- Projects and resources that inspired this work
- Supporting organizations and communities
