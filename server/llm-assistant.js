const { v4: uuid } = require('uuid');

const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
//import { JsonOutputParser } from "@langchain/core/output_parsers";
const { JsonOutputParser } = require("@langchain/core/output_parsers");
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { START, END, Annotation, MemorySaver, MessagesAnnotation, StateGraph } = require("@langchain/langgraph");
const { ChatOpenAI } = require('@langchain/openai');

// Initialize the LLM

const llm = new ChatOpenAI({
  //model: "gpt-4o-mini",
  model: "gpt-4o",
  temperature: 0
});

const llm_config = { configurable: { thread_id: uuid() } };

// Siimple example of using OpenAI LLM/Chatbot with a one-shot question
const getLLMResponseOneShot = async function(prompt_message)
{
    const output = await llm.invoke([{
	role: "user",
	content: prompt_message
    }]);
    
    return output;
};

const prompt_city_by_city = ChatPromptTemplate.fromMessages([
    [
	"system",
	"You are to provide 10 hints about a given city.  Return your answers in JSON format,",
    ],
    new MessagesPlaceholder("messages"),
]);

// Define the function that calls the model for English prompt
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


// Parameterized city (and country) prompt
const prompt_param_city = ChatPromptTemplate.fromMessages([
    [
	"system",
	"You are an assistant that provides hints to a user playing a geo-guessing game.\n "
	    +"The current city the user is trying to guess is {city} in the country {country}.\n "
	    +"Respond with a valid JSON object. "
	    +"The JSON object should have a field called 'country-hints' which is an array or strings.  Each value in the array provides a hint about the country, in order of hardest hint to easiest hint. There should be 5 values in the 'country-hints' field. "
	    +"The JSON object should also have a field called 'city-hints' which is an array or strings.  Each value in this array provides a hint about the city, in order of hardest hint to easiest hint. There should be 10 values in the 'country-hints' field.\n "
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
    //const chain = prompt_param_city.pipe(llm).pipe(json_parser);
    const response = await chain.invoke(state);

    console.log("**** callModelParamCity: ", response);
    
    return { messages: [response] };
    //return response;
};

// Define a new graph for parameterized city and country
const workflowParamCity = new StateGraph(GraphAnnotationParamCity)
      .addNode("model", callModelParamCity)
      .addEdge(START, "model")
      .addEdge("model", END);

const appParamCity = workflowParamCity.compile({ checkpointer: new MemorySaver() });

// Function to get a hint with parameterized city and country
const getLLMHint = async function(city,country) {
    const input = {
	messages: [
	    {
		role: "user",
		content: "You are to provide a set of hints about the {city} in {country}. "
	    },
	],
	city:    city    || "Hamilton",
	country: country || "New Zealand"
    };

    const output = await appParamCity.invoke(input, llm_config);
    console.log("**** output", output);

    const output_last_message = output.messages[output.messages.length - 1]?.content;
    const output_json = await json_parser.parse(output_last_message);
    
    //const output_last_message = output;
    console.log(output_last_message);
    console.log(output_json);
    
    //return output_last_message;
    return output_json;
};

module.exports = { getLLMResponseOneShot, getLLMHintLondon, getLLMHint };
