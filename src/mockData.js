export const mock = {
  simplified: "Photosynthesis is how plants make food. They take in sunlight, water and air. They give out oxygen. This happens in the green parts of the leaf. The green color comes from chlorophyll.",
  mermaid: "graph TD; A[Sunlight] --> D[Photosynthesis]; B[Water] --> D; C[Carbon dioxide] --> D; D --> E[Glucose]; D --> F[Oxygen]",
  flashcards: [
    { q: "What do plants need for photosynthesis?", a: "Sunlight, water and carbon dioxide" },
    { q: "What gives leaves their green color?", a: "Chlorophyll" },
  ],
};
export const big = {
  mermaid:
    "graph TD; " +
    Array.from(
      { length: 24 },
      (_, n) =>
        `N${n}[Step ${n} of the process] --> N${n + 1}[Step ${n + 1} with a much longer label to test wrapping]`
    ).join("; "),
  flashcards: Array.from({ length: 30 }, (_, n) => ({
    q: `Question ${n + 1}: ` + "Explain this concept in detail. ".repeat(n % 4 === 0 ? 15 : 2),
    a: `Answer ${n + 1}: ` + "This is a long explanation. ".repeat(n % 3 === 0 ? 25 : 3),
  })),
};