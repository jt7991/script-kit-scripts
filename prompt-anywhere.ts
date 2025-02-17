/*
# Prompt Anything
Highlight some text and run this script to prompt against it.
Useful for summarizing text, generating a title, or any other task you can think of.

## Usage

- Highlight the text you want to prompt against
- Run the script via shortcut or command palette
- Input your desired prompt
- Wait for the AI to respond
- Select one of the options
* Retry - Rerun generation with option to update prompt
* Edit - Edit response in editor
    - On editor exit the message is saved to the clipboard
    - On editor submit the message is pasted into the highlighted text
* Copy - Copy response to clipboard
* Paste - Paste response into highlighted text
* Save - Save response to file (not working)
## Example
- Highlight: 'Some really long passage in a blog post'
- Run Script
- Prompt: `Summarize this passage in the form of Shakespearean prose`
- Waaaaait for it...
- Get a response from the AI
- Select an option
- Rinse and repeat
*/

// Name: Prompt Anything
// Description: Custom prompt for any highlighted text
// Author: Josh Mabry
// Twitter: @AI_Citizen
// Shortcut: option p

//#################
// ScriptKit Import
//#################
import "@johnlindquist/kit";

//#################
// LangChain Imports
//#################
let { ChatOpenAI } = await import("@langchain/openai");
let { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
//#################
// Request API KEY
//#################
// stored in .env file after first run
// can change there or through the command palette
let openAIApiKey = await env("OPENAI_API_KEY", {
  hint: `Grab a key from <a href="https://platform.openai.com/account/api-keys">here</a>`,
});
// System input / Task for the AI to follow
let userSystemInput = await arg("Summarize this passage");
// User Prompt from highlighted text
let userPrompt = await getSelectedText();

//#################
// Prompt Template
//#################
const formatPrompt = (prompt) => {
  return `##### Ignore prior instructions
- Return answer in markdown format
- You are tasked with the following
${prompt}
########
`;
};
//################
// Options Template
//################
const options = [
  {
    name: "Retry",
    value: "retry",
    description: "Rerun generation with option to update prompt",
  },
  { name: "Edit", value: "edit", description: "Edit response in editor" },
  { name: "Copy", value: "copy", description: "Copy response to clipboard" },
  {
    name: "Paste",
    value: "paste",
    description: "Paste response into highlighted text",
  },
  {
    name: "Save",
    value: "save",
    description: "Save response to file (not working)",
  },
];

//################
// Main Function
//################
/**
 *
 * @param {*} prompt
 * @param {*} humanChatMessage
 */
async function promptAgainstHighlightedText(
  prompt = formatPrompt(userSystemInput),
  humanChatMessage = userPrompt,
) {
  //#########
  // Helpers
  //########
  // exit script on cancel
  const cancelChat = () => {
    log(`Chat cancelled`);
    process.exit(1);
  };

  /**
   * Paste text to highlighted text and exit script
   * @param {*} text
   */
  const pasteTextAndExit = async (text) => {
    await setSelectedText(text);

    log(`Chat cancelled`);
    process.exit(1);
  };

  /**
   * Copy text to clipboard and exit script
   * @param {*} text
   */
  const copyToClipboardAndExit = async (text) => {
    await clipboard.writeText(currentMessage);
    log(`Chat cancelled`);
    process.exit(1);
  };
  let currentMessage = "";
  const llm = new ChatOpenAI({
    // 0 = "precise", 1 = "creative"
    temperature: 0.3,
    // modelName: "gpt-4", // uncomment to use GPT-4 (requires beta access)
    openAIApiKey: openAIApiKey,
    // turn off to only get output when the AI is done
    streaming: true,
    callbacks: [
      {
        handleLLMNewToken: async (token) => {
          // each new token is appended to the current message
          // and then rendered to the screen
          currentMessage += token;
          // render current message
        },
        handleLLMError: async (err) => {
          log(`handleLLMError`, JSON.stringify(err, null, 2));
          dev({ err });
        },
        handleLLMEnd: async () => {
          log(`handleLLMEnd`);
          log("currentMessage:", currentMessage);
          // render final message with options
          const optionsMd = options.map((option) => {
            return `* [${option.name}](submit:${option.value}) - ${option.description}`;
          });
          let html = md(currentMessage + "\n" + optionsMd.join("\n"));
          // wait for user to select an option
          // handle selected option

          const selectedOption = await div(html);

          switch (selectedOption) {
            case "paste":
              await pasteTextAndExit(currentMessage);
            case "retry":
              // reset current message
              currentMessage = "";
              // prompt again with new prompt
              // press enter to use original prompt
              const followUp = await arg({
                placeholder: userSystemInput,
                hint: "Press enter to use the same prompt",
              });
              break;
            case "edit":
              // @TODO still need to figure out best way to handle submit and abort
              // would like custom buttons for triggering all of the actions like copy, paste, etc
              await editor({
                value: currentMessage,
                onEscape: async (state) => await copyToClipboardAndExit(state),
                onSubmit: async (state) => await pasteTextAndExit(state),
              });
              break;
            case "copy":
              await copyToClipboardAndExit(currentMessage);
            case "save":
              await inspect(currentMessage, `/conversations/${Date.now()}.md`);
            default:
              copyToClipboardAndExit(currentMessage);
          }
        },
      },
    ],
  });
  //###########
  // Main Loop
  //###########
  // runs the language model until the user cancels
  while (true) {
    log(`prompt`, prompt);
    log(`humanChatMessage`, humanChatMessage);
    try {
      const res = await llm.invoke([
        new SystemMessage(formatPrompt(prompt)),
        new HumanMessage(humanChatMessage),
      ]);
      log(`res`, res);
    } catch (error) {
      log(`error`, error);
    }
  }
}

await promptAgainstHighlightedText();
