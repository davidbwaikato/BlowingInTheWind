const { v4: uuid } = require('uuid');

const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { START, END, Annotation, MemorySaver, MessagesAnnotation, StateGraph } = require("@langchain/langgraph");
const { ChatOpenAI } = require('@langchain/openai');

// For background details on how to work with langchain in JavaScript see:
//    https://js.langchain.com/docs/tutorials/chatbot/

const llm = new ChatOpenAI({
    model: "gpt-4o", // "gpt-4o-mini" another option to consider
    temperature: 0.5 // have the temperature set so it hints for the same city vary over time
});

// **** change this to be per RoomID
const llm_config = { configurable: { thread_id: uuid() } };

// (1) Simple example of using LangChain to contact OpenAI LLM/Chatbot with a one-shot question
const getLLMResponseOneShot = async function(prompt_message)
{
    const output = await llm.invoke([{
	role: "user",
	content: prompt_message
    }]);
    
    return output;
};

// (2) The following 'chain' starts with a hard-wired base system, and
// then expects the provided prompt to name the city (and country) for the hints
// This code pattern closely follows the LangChain example

const prompt_city_by_city = ChatPromptTemplate.fromMessages([
    [
	"system",
	"You are to provide 10 hints about a given city.",
    ],
    new MessagesPlaceholder("messages"),
]);

// Define the function that calls the model for city-by-city prompt
const callModelCBC = async (state) => {
    const chain = prompt_city_by_city.pipe(llm);
    const response = await chain.invoke(state);
    
    return { messages: [response] };
};

// Define a new graph for the English workflow
const workflowCBC = new StateGraph(MessagesAnnotation)
      .addNode("model", callModelCBC)
      .addEdge(START, "model")
      .addEdge("model", END);

// Add memory
const llm_app_cbc = workflowCBC.compile({ checkpointer: new MemorySaver() });

// Function to get a hint in English
const getLLMHintLondon = async function() {
    const messages_input = [
	{
	    role: "user",
	    content: "Provide a hint about London, England.",
	},
    ];
    
    const output = await llm_app_cbc.invoke({ messages: messages_input }, llm_config);
    
    const output_last_message = output.messages[output.messages.length - 1]?.content;
    console.log(output_last_message);

    return output_last_message
};

// (3) This 'chain' is tailored to what is needed in BITW.  It follows the
// parameterised version of a 'chain' in the LangChain docs, but -- rather
// than returning the raw LLM message -- it crafts a JSON reponse of hints
// that can be directly accessed


// Parameterized city (and country) prompt

const prompt_param_city = ChatPromptTemplate.fromMessages([
    [
	"system",
	"You are an assistant that provides hints to a user playing a geo-guessing game.\n "
	    +"The current city the user is trying to guess is {city} in the country {country}.\n "
	    +"You give hints both about the city and the country. "
	    +"When giving a hint about the country, do not include a term that contains the name of the country. "
	    +"When giving a hint about the country, do not include the name of the city that is to be guessed! "
	    +"When giving a hint about the city, never use a term that contains the name of the city that is being guessed! "
	    +"However, for a hint about the city, it is OK to use the name of the country the city is in. "
	    +"When giving a hint about the city, do not provide a hint that has already been given as a country hint.\n "
	    //+"For the very last hint given for the city, always express the hint in the form of an anagram.  Ensure the anagram has the same number of letters in it as the original city name.\n "
	//as 'The city name is an anagram of ...' "
	    //+"When generating an anagram, pay attention to the frequency and types of letters in the original word or phrase. Make sure the resulting anagram uses the exact same letters, in the same quantity, as the original, but rearranged in a different order.\n "
	//+"While a fun anagram is made up of other words that have exactly the same letters, this is not a requirement for this hint.  If it is not possible to provide an word-like anagram then jumble the letters shown instead, rather than provide an anagram that does fails to include all the right letters.\n "
	//+"Use your computational functionality to double-check that the anagram provided is an exact match with the city name.\n "
	    //+"For the very last hint given for the city, always express the hint as a word jumbled 'The letters of the city name jumbled up are ... ' "	
	    +"Respond with a valid JSON object. "
	    +"The JSON object should have a field called 'country-hints' which is an array or strings.  Each value in the array provides a hint about the country, in order of hardest hint to easiest hint. There should be 4 values in the 'country-hints' field. "
		+"The JSON object should also have a field called 'city-hints' which is an array or strings.  Each value in this array provides a hint about the city, in order of hardest hint to easiest hint. There should be 9 values in the 'country-hints' field.\n "
    ],
    new MessagesPlaceholder("messages"),
]);

// Define the State with city and country parameters
const GraphAnnotationParamCity = Annotation.Root({
    ...MessagesAnnotation.spec,
    city:    new Annotation(),
    country: new Annotation()
});

const json_parser = new JsonOutputParser();

// Define the function that calls the model with parameterized city and country
const callModelParamCity = async (state) => {
    const chain = prompt_param_city.pipe(llm);
    const response = await chain.invoke(state);

    return { messages: [response] };
};

// Define a new graph for parameterized city and country
const workflowParamCity = new StateGraph(GraphAnnotationParamCity)
      .addNode("model", callModelParamCity)
      .addEdge(START, "model")
      .addEdge("model", END);

const appParamCity = workflowParamCity.compile({ checkpointer: new MemorySaver() });

// Function to get a hint with parameterized city and country
const getLLMHint = async function(city,country, callback) {
    const input = {
	messages: [
	    new HumanMessage("You are to provide a set of hints about the {city} in {country}."),
	    /*{
		role: "user",
		content: "You are to provide a set of hints about the {city} in {country}. "
	    },*/
	],
	city:    city    || "Hamilton",
	country: country || "New Zealand"
    };

    const output = await appParamCity.invoke(input, llm_config);

    const output_last_message = output.messages[output.messages.length - 1]?.content;
    const output_json = await json_parser.parse(output_last_message);

    callback(output_json);
    
    //return output_json;
};

module.exports = { getLLMResponseOneShot, getLLMHintLondon, getLLMHint };
