import fs from "node:fs";

const wfPath = "scripts/n8n/miami-motors-whatsapp-full.json";
const promptPath = "scripts/n8n/prompts/miami-agent-system-prompt.txt";
const modelPromptPath = "scripts/n8n/prompts/miami-message-model-system-prompt.txt";

const wf = JSON.parse(fs.readFileSync(wfPath, "utf8"));
const agentPrompt = fs.readFileSync(promptPath, "utf8").replace(/\r\n/g, "\n");
const modelPrompt = fs.readFileSync(modelPromptPath, "utf8").replace(/\r\n/g, "\n");

const agent = wf.nodes.find((n) => n.name === "AI Agent");
agent.parameters.options.systemMessage = agentPrompt;

const model = wf.nodes.find((n) => n.name === "Message a model");
const sys = model.parameters.responses.values.find((v) => v.role === "system");
sys.content = modelPrompt;

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2));
console.log("Patched", wfPath);
