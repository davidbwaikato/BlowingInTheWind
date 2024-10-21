

const APP_NAME = "BITW";


// Method for shuffling an array
//   https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array

function shuffleArray(array)
{
    let currentIndex = array.length;
    while(currentIndex != 0){
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}



function createRandomizedArray(array)
{
    let array_copy = [...array];
    shuffleArray(array_copy);
    
    return array_copy;
}



function getTimeStamp()
{
    const date_now = new Date();
    const hours = date_now.getHours();
    const mins  = date_now.getMinutes();
    
    const time_str = hours + ":" + String(mins).padStart(2,"0");

    return time_str;
}


function createMessage(roomId,message)
{
    const time_str = getTimeStamp();
				   
    let message_template = {
        room: roomId,
        author: APP_NAME +' Assistant',
        message: message,
	time: time_str
    };

    return message_template;
}

module.exports = { APP_NAME, createRandomizedArray, createMessage };
