import assert from "node:assert/strict";
import test from "node:test";
import { deriveEvidenceQuote, validateGroundedQuestion } from "./grounding.js";

const sources = [{
  document_id: "doc-1",
  text: "Photosynthesis occurs in the chloroplast. Chlorophyll absorbs red light and blue light. Mitochondria release energy from food. Stomata regulate gas exchange.",
}];

test("accepts an MCQ whose choices and correct answer are grounded", () => {
  const result = validateGroundedQuestion({
    type: "mcq",
    prompt: "Where does photosynthesis occur?",
    options: ["chloroplast", "Mitochondria", "Chlorophyll", "Stomata"],
    answer: { correct_index: 0 },
    source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, true);
  assert.equal(result.source?.document_id, "doc-1");
});

test("accepts naturally phrased MCQ options grounded in document terminology", () => {
  const result = validateGroundedQuestion({
    type: "mcq",
    prompt: "Which structure is responsible for photosynthesis?",
    options: [
      "The chloroplast",
      "Energy-releasing mitochondria",
      "Light-absorbing chlorophyll",
      "Gas-regulating stomata",
    ],
    answer: { correct_index: 0 },
    source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, true);
});

test("rejects non-English MCQ prompts", () => {
  const result = validateGroundedQuestion({
    type: "mcq", prompt: "¿Cuál es la respuesta correcta?",
    options: ["chloroplast", "Mitochondria", "Chlorophyll", "Stomata"],
    answer: { correct_index: 0 }, source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /English/);
});

test("rejects placeholder MCQ choices", () => {
  const result = validateGroundedQuestion({
    type: "mcq", prompt: "Where does photosynthesis occur?",
    options: ["option A", "option B", "option C", "option D"],
    answer: { correct_index: 0 }, source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /placeholders/);
});

test("rejects commentary embedded in MCQ choices", () => {
  const result = validateGroundedQuestion({
    type: "mcq", prompt: "Where does photosynthesis occur?",
    options: ["chloroplast", "Mitochondria", "The correct option should be selected here", "Stomata"],
    answer: { correct_index: 0 }, source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /commentary/);
});

test("rejects invented acronym expansions", () => {
  const result = validateGroundedQuestion({
    type: "mcq", prompt: "What does the Photosynthesis System (PS) produce?",
    options: ["chloroplast", "Mitochondria", "Chlorophyll", "Stomata"],
    answer: { correct_index: 0 }, source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /unsupported expansion/);
});

test("rejects a quote not copied from an uploaded chunk", () => {
  const result = validateGroundedQuestion({
    type: "fill_blank",
    prompt: "Photosynthesis occurs in the ____.",
    answer: { accepted: ["chloroplast"] },
    source_index: 1,
    source_quote: "Plants perform this process inside a chloroplast.",
  }, "fill_blank", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /verbatim/);
});

test("derives verbatim evidence using the declared correct choice", () => {
  const quote = deriveEvidenceQuote({
    prompt: "Where does photosynthesis occur?",
    options: ["chloroplast", "Mitochondria", "Chlorophyll", "Stomata"],
    answer: { correct_index: 0 },
  }, "mcq", sources[0].text);
  assert.equal(quote, "Photosynthesis occurs in the chloroplast.");
});

test("rejects document-referential question wording", () => {
  const result = validateGroundedQuestion({
    type: "mcq",
    prompt: "According to the uploaded document, where does photosynthesis occur?",
    options: ["chloroplast", "Mitochondria"],
    answer: { correct_index: 0 },
    source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /must not refer/);
});

test("rejects templated sentence-completion wording", () => {
  const result = validateGroundedQuestion({
    type: "mcq",
    prompt: "Which statement completes the sentence about photosynthesis?",
    options: ["chloroplast", "Mitochondria", "Chlorophyll", "Stomata"],
    answer: { correct_index: 0 },
    source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /prohibited/);
});

test("rejects overly long question wording", () => {
  const result = validateGroundedQuestion({
    type: "mcq",
    prompt: Array(75).fill("photosynthesis").join(" "),
    options: ["chloroplast", "Mitochondria", "Chlorophyll", "Stomata"], answer: { correct_index: 0 },
    source_index: 1, source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "mcq", sources);
  assert.equal(result.valid, false);
  assert.match(result.reason || "", /too long/);
});

test("allows a concise generic matching instruction when every pair is grounded", () => {
  const result = validateGroundedQuestion({
    type: "matching", prompt: "Match each term with its corresponding statement.",
    options: {
      left: ["Photosynthesis", "Mitochondria"],
      right: ["Mitochondria release energy from food", "Photosynthesis occurs in the chloroplast"],
    },
    answer: { pairs: [[0, 1], [1, 0]] }, source_index: 1,
    source_quote: "Photosynthesis occurs in the chloroplast.",
  }, "matching", sources);
  assert.equal(result.valid, true);
});
