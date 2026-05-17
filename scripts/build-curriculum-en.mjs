import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const design = JSON.parse(readFileSync(join(root, "topics_lessons_design.json"), "utf8"));

const titleEn = {
  "664a000000000000000000001": "Getting Started with Blockly",
  "664a000000000000000000002": "Printing to the Screen",
  "664a000000000000000000003": "Variables",
  "664a000000000000000000004": "Arithmetic Operations",
  "664a000000000000000000005": "User Input",
  "664a000000000000000000006": "Conditional Statements",
  "664a000000000000000000007": "Loops",
  "664a000000000000000000008": "Functions",
  "664a000000000000000000009": "Capstone Projects",
  "664b000000000000000000001": "What Is the Blockly Interface?",
  "664b000000000000000000002": "Your First Drag-and-Drop Blocks",
  "664b000000000000000000003": "Exercise: Assemble a Command Sequence",
  "664b000000000000000000004": "Print a Single Line of Text",
  "664b000000000000000000005": "Print Multiple Lines of Text",
  "664b000000000000000000006": "Exercise: Print Your Name",
  "664b000000000000000000007": "Exercise: Print Personal Info",
  "664b000000000000000000008": "What Are Variables?",
  "664b000000000000000000009": "Create a Variable and Assign a Value",
  "664b00000000000000000000a": "Integer Variables",
  "664b00000000000000000000b": "String Variables",
  "664b00000000000000000000c": "Exercise: Calculate Square Area",
  "664b00000000000000000000d": "Add Two Numbers",
  "664b00000000000000000000e": "Subtract Two Numbers",
  "664b00000000000000000000f": "Multiply and Divide",
  "664b000000000000000000010": "Exercise: Sum, Difference, Product, Quotient",
  "664b000000000000000000011": "Exercise: Rectangle Perimeter and Area",
  "664b000000000000000000012": "Ask and Receive an Answer",
  "664b000000000000000000013": "Use the Value Just Entered",
  "664b000000000000000000014": "Exercise: Simple Addition Calculator",
  "664b000000000000000000015": "Exercise: Greet by Name",
  "664b000000000000000000016": "Compare Two Values",
  "664b000000000000000000017": "Simple if Statement",
  "664b000000000000000000018": "if-else Statement",
  "664b000000000000000000019": "Exercise: Find the Larger Number",
  "664b00000000000000000001a": "Exercise: Grade Classification",
  "664b00000000000000000001b": "Repeat a Fixed Number of Times",
  "664b00000000000000000001c": "Loop with a Counter Variable",
  "664b00000000000000000001d": "Exercise: Print Numbers 1 to 10",
  "664b00000000000000000001e": "Exercise: Sum 1 + 2 + ... + N",
  "664b00000000000000000001f": "Exercise: Multiplication Table",
  "664b000000000000000000020": "What Are Functions?",
  "664b000000000000000000021": "Create and Call a Simple Function",
  "664b000000000000000000022": "Functions with Parameters",
  "664b000000000000000000023": "Functions That Return a Value",
  "664b000000000000000000024": "Exercise: Circle Area Function",
  "664b000000000000000000025": "Project: Four-Operation Calculator",
  "664b000000000000000000026": "Project: Number Guessing Game",
  "664b000000000000000000027": "Project: Student Grade Report",
};

const descEn = {
  "664a000000000000000000001":
    "Explore the Blockly drag-and-drop interface, learn how blocks work, and practice your first simple programs.",
  "664a000000000000000000002":
    "Use Print blocks to display text and numbers on screen, similar to cout in C++.",
  "664a000000000000000000003":
    "Learn to create variables, assign values, and reuse them. Understand number and string variables.",
  "664a000000000000000000004":
    "Perform addition, subtraction, multiplication, and division with operator blocks and apply them to real problems.",
  "664a000000000000000000005":
    "Interact with users by asking questions, reading input, processing it, and showing results.",
  "664a000000000000000000006":
    "Use if/else to branch logic based on comparisons and handle multiple cases in one program.",
  "664a000000000000000000007":
    "Repeat groups of commands with repeat and count blocks. Combine loops with variables to solve summation problems.",
  "664a000000000000000000008":
    "Package commands into named functions, call them repeatedly, and build functions with parameters and return values.",
  "664a000000000000000000009":
    "Combine everything you learned to build three real apps: a calculator, a guessing game, and a grade report.",
};

const out = {};

function lessonDescriptionEn(lesson) {
  const id = lesson._id.$oid;
  if (descEn[id]) return descEn[id];
  const title = titleEn[id] ?? lesson.title;
  return `In this lesson, you will practice: ${title}. Use Blockly blocks to complete the activity and check your output.`;
}

for (const topic of design.topics) {
  const id = topic._id.$oid;
  out[id] = {
    title: titleEn[id] ?? topic.title,
    description: descEn[id] ?? topic.description,
  };
}

for (const lesson of design.lessons) {
  const id = lesson._id.$oid;
  out[id] = {
    title: titleEn[id] ?? lesson.title,
    description: lessonDescriptionEn(lesson),
  };
}

writeFileSync(join(root, "src/i18n/curriculum.en.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${Object.keys(out).length} curriculum EN entries.`);
