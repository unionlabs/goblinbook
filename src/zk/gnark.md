# Intro to Gnark

Gnark is a zkSNARK library developed by ConsenSys that allows developers to design and implement zero-knowledge circuits in Go. Unlike other circuit libraries that use domain-specific languages, Gnark lets you write circuits directly in Go, making it more accessible to developers already familiar with the language.

At its core, a zero-knowledge circuit defines a computational relationship between public inputs and private witness values. When we generate a proof, we're essentially proving that we know witness values that satisfy this relationship, without revealing those values.

When using Gnark, we define a struct that describes our computation, and as member fields, the inputs of our computation. Below we have a circuit which proves knowledge of Sudoku solutions. The two inputs are `Challenge`, which is the puzzle, and `Solution`, which is the completely filled in puzzle.

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:circuit}}
```

Our `Sudokugrid` type is just a simple 9x9 matrix:

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:sudokugrid}}
```

Next is where we define the actual circuit. In this book, we will not go into concepts such as [arithmetization]() or [rc1s](), although we will see some of that in the actual code. For now it suffices to know, that we define rules that our inputs have to abide by. We refer to these rules as _constraints_.

For a sudoku solution to be checked, we have to verify the following:

1. Each cell may only have a value from 1 to 9.
1. Each row may only contain unique values.
1. Each column may only contain unique values.
1. Each 3x3 sub grid may only contain unique values.
1. The solution is for the given puzzle.

Especially rule `5` is easy to forget. If we would not implement that, our checker would allow any valid solved sudoku to solve our puzzle.

We define the constraints inside the Define function, which accepts an `api frontend.API`, which is the object we use to actually define our circuit.

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:define-signature}}
```

For each rule, we call various assertions on the `api`. These assertions are not run immediately. Instead we are building a program under the hood, to be run later against actual variables. The actual for loop is not part of our circuit either, instead it is just execution each instruction one-by-one, effectively unrolling the loop.

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:constraint-1}}
```

For rules 2, 3, and 4, the implementation is similar

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:constraint-2}}

{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:constraint-3}}

{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:constraint-4}}
```

Rule 5 uses the `Select` method, which is how we can implement `if` statements in the circuit.

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:constraint-5}}
```

Actually generating a proof requires compiling and setting up the circuit.

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:setup}}
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:compile}}
```

In this code example, we are doing an unsafe setup, which makes the circuit unsafe for actual usage. Union ran a [setup ceremony](https://ceremony.union.build), where multiparty computation is used to make the setup safe and production ready. The `circuit`, `vk` and `pk` can be written to disk for later usage; we should only compile and setup once.

With these values, and some sample inputs, we can start generating proofs.

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:prove}}
```

We could now serialize the proof, and send it to a verifier (someone on a different machine).

```go
{{ #shiftinclude  auto:../snippets/intro-to-gnark.go:prove}}
```

As you can see, they have only access to the `challenge`, not the `solution`. The proof will verify that the prover has a valid solution, without leaking information on that solution.

Now that we know the basics of Gnark, let's analyze the light client circuit. We will see that the applied techniques are very similar to the Sudoku grid. Effectively we are re-implmenenting cryptographic primitives using the `frontend.API`.
