const fs      = require('fs');
const path    = require('path');

const utils = require("./utils");

const readMP3Filelist = function(full_root_dir,mp3_directory)
{
    // Default is for there to be no files listed
    let returnJSON = { "status": null, "mp3-filelist": [] };
    
    let mp3_files = []

    const audio_mp3_dir = path.join('audio',mp3_directory)    
    const full_mp3_directory = path.join(full_root_dir,audio_mp3_dir)

    try {

	//if (!fs.lstatSync(full_mp3_directory).isDirectory()) {
	if (!fs.existsSync(full_mp3_directory)) {
	    const warn_message = "Warning: Failed to find directory: "
		  + full_mp3_directory + "\n"
	          + "No music tracks will be available to be played while playing ${utils.APP_NAME}";
	    console.warn(warn_message);
	    
	    returnJSON['warning']  = `Failed to find '${mp3_directory}'.  No music tracks will be played while playing ${utils.APP_NAME}`;
	}
	else {
	    let files = fs.readdirSync(full_mp3_directory,"utf8");
	    
	    files.forEach(function (file) {
		let full_mp3_file = path.join(full_mp3_directory, file);
		
		if (file.endsWith(".mp3")) {
		    const file_url = encodeURI(file);
		    mp3_files.push(file_url);
		}
	    });

	    const randomized_mp3_files = utils.createRandomizedArray(mp3_files);
	    
	    returnJSON['url-path-prefix'] = "/"+audio_mp3_dir;	    
	    returnJSON['mp3-filelist'] = randomized_mp3_files;
	}
	
	returnJSON['status'] = "ok";
    }
    catch (err) {
	const err_message = "Failed to read directory: " + full_mp3_directory;
	
	console.error(err_message);
	console.error();
	console.error(err);

	returnJSON['status'] ="failed";
	returnJSON['error']  = `Failed to read directory '${mp3_directory}'`;
    }

    return returnJSON;
}

module.exports = { readMP3Filelist };
