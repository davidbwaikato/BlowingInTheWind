/////////////  PUBLIC //////////////

import config from "./config.js";
import { fetchWeatherData } from "./weather.js";

// Set access token
Cesium.Ion.defaultAccessToken = config.CESIUM_API_KEY;

/*********************************
 * Get connect to WebSocket Server
 *********************************/
//import socket from './SocketInstance.js';

/*
const SERVER_URL  = config.SERVER_URL

const ws_socket_url = `${SERVER_URL}`
console.log(`Creating connection to Web-Socket server: ${ws_socket_url}`)

const socket = io(ws_socket_url);
console.log("**** bitw_scripts.js global init time, bitw_socket = ", window.bitw_socket);
*/

//const socket = window.bitw_socket;
//console.log("**** bitw_scripts.js socket = ", socket);

window.bitws_registerSocketOn = function(socket) {
    /*
    window.joinRoom = function(room){
	//console.log("**** window.joinRoom() bitw_socket = ", window.bitw_socket);
	socket.emit("join_room", room);
    }
*/

    socket.on("city_data", (data) => {
	console.log("socket.on('city_data') data:", data)
	
	const city_name = data.city;    
	const city_coord_xyz = Cesium.Cartesian3.fromDegrees(data.coordinates[0], data.coordinates[1], data.coordinates[2]); // convert (lat,long,height) into coord (x,y,z)
	const city_cartographic_rad = Cesium.Cartographic.fromCartesian(city_coord_xyz); // convert (x,y,z) into (long,lat,height) with angles in radians
	
	const city_info = { cityName: city_name, coord_xyz: city_coord_xyz, cartographic_rad: city_cartographic_rad };
	
	appendCity(city_info);    
	teleportToCurrentCity();
    });
}


/*********************************
 * Cesium/Ballon Setup
 *********************************/

// Initialise Cesium Viewer


const DefaultFlyingAltitudeMeters = 300.0; // meters
const DefaultPitchAngleRad        = Cesium.Math.toRadians(-15.0);
const cameraOffset = new Cesium.HeadingPitchRange(0.0, DefaultPitchAngleRad, DefaultFlyingAltitudeMeters);

let viewer = null;

let startTime;
let nextTimeStep;

let BalloonSurrogateEntity = null;
let BuildingTileSet = null;

window.bitws_initStartingLocation = function(socket) {
    
    if (viewer != null) {
	// Retrieve default starting position from server, and dreate (surrogate) balloon entity at that position

	socket.emit('get_starting_location', (response_data) => {
	    
	    const default_long = response_data.coordinates[0];
	    const default_lat  = response_data.coordinates[1];
	    const default_alt  = response_data.coordinates[2];
	    
	    BalloonSurrogateEntity = viewer.entities.add({
		name: "The (surrogate) hot air balloon",
		// Move entity via simulation time
		availability: new Cesium.TimeIntervalCollection([
		    new Cesium.TimeInterval({
			start: startTime,
			stop: startTime
		    }),
		]),
		// Use path created by the function
		//position: Cesium.Cartesian3.fromDegrees(DefaultStartingPosition.long,DefaultStartingPosition.lat,DefaultStartingPosition.height), // ****
		position: Cesium.Cartesian3.fromDegrees(default_long,default_lat,default_alt),
		// Placeholder entity visuals
		ellipsoid: {
		    radii: new Cesium.Cartesian3(52.0, 52.0, 52.0),
		    material: Cesium.Color.RED.withAlpha(0),
		},
		// Show path of hot air balloon
		path: {
		    resolution: 1,
		    // material: new Cesium.PolylineGlowMaterialProperty({
		    //   glowPower: 0.1,
		    //   color: Cesium.Color.YELLOW,
		    // }),
		    width: .1,
		},
	    });
	    
	    // Deliberately wait for 4 seconds, with Cesium showing its initial world view, before
	    // changing to the default location provided by the BITW server
	    setTimeout(function() {
		// Quick camera focus to entity 
		viewer.zoomTo(BalloonSurrogateEntity, cameraOffset);
		viewer.scene.primitives.add(BuildingTileSet);
		
		// Or set tracked entity for instant zoom
		// viewer.trackedEntity = BalloonSurrogateEntity;
	    },4000);    	
	});    
    }

}


try {
    viewer = new Cesium.Viewer("cesiumContainer", {
	terrain: Cesium.Terrain.fromWorldTerrain(),
	infoBox: false,
	selectionIndicator: false,
    });

    // Set startTime to current time
    startTime = viewer.clock.currentTime;
    // Initialise nextTimeStep
    nextTimeStep = startTime;

    // Set clock settings
    viewer.clock.startTime = startTime.clone();
    viewer.clock.currentTime = startTime.clone();
    //viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; //Loop at the end
    // Start animating at x1 speed
    viewer.clock.multiplier = 1;
    //viewer.clock.shouldAnimate = true;

    viewer.scene.screenSpaceCameraController.enableZoom = false;
}
catch (error) {
    // One example of a error being thrown at this point is if your browser doesn't support WebGL
    console.error("Failed to create Cesium Viewer");
}


//viewer.scene.debugShowFramesPerSecond = true;

/*********************************
 * VISUALISE BUILDINGS
 *********************************/
if (viewer != null) {
    // Google Map's Photorealistic 3d Tileset
    try {
	console.log("Loading on GooglePhotorealistic3DTileset");
	BuildingTileSet = await Cesium.createGooglePhotorealistic3DTileset();
	//viewer.scene.primitives.add(BuildingTileSet);
    }
    catch (error) {
	console.log(`Failed to load tileset: ${error}`);
    }
}

/*********************************
 * WIND API
 *********************************/
//module lever variables to store wind data
//let windSpeed, windDirection; // ****

// Conversion to degrees (long,lat) from cartesian
//
// [ Aligns with details given on StackOverflow:
//     https://stackoverflow.com/questions/28358403/how-to-convert-x-y-z-to-longitude-latitude-altitude-in-cesium ]

function cartesianToDegrees(cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);

    return { longitude: longitude, latitude: latitude};
}

//gets the wind data and stores it to the module level variables
/*
async function fetchAndStoreWind(latitude, longitude){
    const weatherWind=  await fetchWeatherData(latitude, longitude);

    return { windDirection: weatherWind.windDirection, windSpeed: weatherWind.windSpeed }
}
*/

/*********************************
 * Location (e.g. city) based utility functions
 *********************************/

let JourneyItinerary = {
    cityInfoArray:           [],
    startingCityPointsArray: [],
    currentCityIndexPos:     -1,
};

function appendCity(new_city_info)
{
    console.log("appendCity(new_city_info)");
    console.log("  adding: ",  new_city_info);

    JourneyItinerary.cityInfoArray.push(new_city_info);
    generateRandomStartingPoint(new_city_info);
    
    JourneyItinerary.currentCityIndexPos++;    
}

function getCurrentCityInfo()
{
    if (JourneyItinerary.currentCityIndexPos >= 0) {
	return JourneyItinerary.cityInfoArray[JourneyItinerary.currentCityIndexPos];
    }
    else
    {
	return null;
    }
}

function getCurrentStartingCoordXYZ()
{
    if (JourneyItinerary.currentCityIndexPos >= 0) {
	return JourneyItinerary.startingCityPointsArray[JourneyItinerary.currentCityIndexPos].coord_xyz;
    }
    else
    {
	return null;
    }
}

// Finds a location near a city's centre coordinate
function getNearbyLocation(cityCartesianPoint)
{
  console.log(`getNearbyLocation(${cityCartesianPoint})`);
    
  const EARTH_R = 6371 * Math.pow(10, 3);
  const MAX_R = 10000; // 10000m 

  let cityCartographicPoint = Cesium.Cartographic.fromCartesian(cityCartesianPoint);
  let city_lon_deg = Cesium.Math.toDegrees(cityCartographicPoint.longitude);
  let city_lat_deg = Cesium.Math.toDegrees(cityCartographicPoint.latitude);

  let lonOffset = Math.floor(Math.random() - 0.5) * 0.03;
  let latOffset = Math.floor(Math.random() - 0.5) * 0.03;

  let ran_lon_deg = city_lon_deg + lonOffset;
  let ran_lat_deg = city_lat_deg + latOffset;

  let lat1 = city_lat_deg * (Math.PI / 180);
  let lat2 = ran_lat_deg * (Math.PI / 180);
  let lon1 = city_lon_deg;
  let lon2 = ran_lon_deg;

  let changeLat = (lat2 - lat1) * Math.PI / 180;
  let changeLon = (lon2 - lon1) * Math.PI / 180;

  let a = Math.sin(changeLat / 2) * Math.sin(changeLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(changeLon / 2) * Math.sin(changeLon / 2); 
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  let distance = EARTH_R * c;

  //console.log(distance);
  if (distance < MAX_R && distance > 0){
    return Cesium.Cartesian3.fromDegrees(ran_lon_deg, ran_lat_deg, DefaultFlyingAltitudeMeters);
  } else {
    console.log("Randomized nearby location out of bounds, returning null");
    return null;
  }
}

function generateRandomStartingPoint(newCity)
{
  console.log("generateRandomStartingPoint()");
    
  let randomStartingPoint = null;
  while(randomStartingPoint == null){
    randomStartingPoint = getNearbyLocation(newCity.coord_xyz);
  }

  let randomStartingPointInfo = { cityName: newCity.cityName, coord_xyz: randomStartingPoint };
  console.log("**** Pushing on cityInfo randomStatingPoint: ", randomStartingPointInfo);
  JourneyItinerary.startingCityPointsArray.push(randomStartingPointInfo);

  if (viewer != null) {

      viewer.entities.add({
	  position: newCity.coord_xyz,
	  name: newCity.cityName,
	  //point: { pixelSize: 15, color: Cesium.Color.BLUE }
      });

      // ****
      console.log("**** Unclear why all the points in JourneyItinerary.startingCityPointsArray are added in again as entities");  
      for(let i=0; i<JourneyItinerary.startingCityPointsArray.length; i++){
	  viewer.entities.add({
	      position: JourneyItinerary.startingCityPointsArray[i].coord_xyz,
	      name: JourneyItinerary.startingCityPointsArray[i].cityName,
	      //point: { pixelSize: 15, color: Cesium.Color.GREEN }
	  });
      }
  }
}

/*********************************
 * PATHING
 *********************************/
// One minute
const MinuteInSecs = 60;

// How many points to put on the map
const NumPathPoints = 5;

// Set up clock
// => Time it takes to go to destination
const TimeStepInSeconds = MinuteInSecs * 30;


/* INITIAL VALUES ON LOAD */

// Track the last time generatePath that was called
let lastGeneratePathTime = null;
if (viewer != null) {
    lastGeneratePathTime = viewer.clock.currentTime;
}
let pathEntityInterval = 100;
let pathSpeed = 0.1;
let pathEntitiesRemoved = 0;
let epsilon = 0.00005;   // tolerance value

// Array to store path positions
let positionPathPointArray = null;

/* CREATE PATH */
// Create the path for the target object
async function createPath(targetObject, startPos, numOfPoints, timeToNextPoint) {
  //Reset array
  positionPathPointArray = [];
  // Storage for last point on map where wind data was obtained from
  let lastPointOnMap = startPos;
  // Calculate timeStep
  let timeStep = MinuteInSecs * timeToNextPoint;
  // Set new stopping point
  let stop = Cesium.JulianDate.addSeconds(startTime, timeStep * numOfPoints, new Cesium.JulianDate());
  // Update viewer's clock to extend animations
  viewer.clock.stopTime = stop.clone();

  // Create SampledPositionProperty (this is a container for the list of points on the map)
  const positionProperty = new Cesium.SampledPositionProperty();

  // Add the last point on the map to the list of points
  positionProperty.addSample(startTime, lastPointOnMap); // We might need to remove this eventually as this might bug out if 2 points are on the exact same coordinates

  // Plot points on the map
  for (let i=0; i<NumPathPoints; i++) {  
    // Calculate timestep
    const time = Cesium.JulianDate.addSeconds(nextTimeStep, TimeStepInSeconds, new Cesium.JulianDate());
    // Get wind data from last point to get the next point to plot
    const thisPoint = await getWindBlownNextPoint(lastPointOnMap);
    // Change lastPoint to this current one
    lastPointOnMap = thisPoint;
    //add position to array
    //positionPathPointArray.push(thisPoint);
    positionPathPointArray[i] = thisPoint;
    // Add to the path
    positionProperty.addSample(time, thisPoint);

    // Increment time
    nextTimeStep = time;
    
    // Format date and time for easier reading
    const newDate = Cesium.JulianDate.toGregorianDate(time, new Cesium.GregorianDate());
    const text = "pos" + (i+1) + " -- " + newDate.year + "/" + newDate.month + "/" + newDate.day + " | "
               + newDate.hour + ":" + newDate.minute + ":" + newDate.second;

    // Create entity based on sample position
    viewer.entities.add({
      position: thisPoint,
      name: text,
      //point: { pixelSize: 15, color: Cesium.Color.RED }
    });
  }

  // Set targetObject availability
  targetObject.availability = new Cesium.TimeIntervalCollection([
                                new Cesium.TimeInterval({
                                  start: viewer.clock.currentTime,
                                  stop: stop
                                }),
                              ]);
  // Set targetObject path
  targetObject.position = positionProperty;
  // Orient targetObject towards movement
  targetObject.orientation = new Cesium.VelocityOrientationProperty(positionProperty);
  // Change interpolation mode to make path more curved
  targetObject.position.setInterpolationOptions({
    interpolationDegree: 5,
    interpolationAlgorithm:
      Cesium.LagrangePolynomialApproximation,
  });

  return positionProperty;
}

async function animatePath(pEntity,startingCoordXYZ,positionPathToFollow) {
    // Create SampledPositionProperty
    //console.log("LOG 1 (animatePath):", new Date().toISOString());
    const positionProperty = new Cesium.SampledPositionProperty();
    
    // Plot points on the map
    let pEntityStartTime = viewer.clock.currentTime;
    //positionProperty.addSample(pEntityStartTime, startPos); 
    
    //add first position
    positionProperty.addSample(pEntityStartTime, startingCoordXYZ);
    //console.log(pEntity); // ****
    //positionProperty.addSample(pEntityStartTime, pEntity.position);
    
    //console.log("Path Point One: " + startingCoordXYZ)
    nextTimeStep = pEntityStartTime;
    
    for (let i=0; i<positionPathToFollow.length; i++) {
	const time = Cesium.JulianDate.addSeconds(nextTimeStep, TimeStepInSeconds * pathSpeed, new Cesium.JulianDate());

	const thisPoint = positionPathToFollow[i];
	
	//console.log(`**** positionPathToFollow[${i}]:`, positionPathToFollow[i]);
	//console.log("**** positionDeltaXYZ:",positionDeltaXYZ);
	//const thisPoint = new Cesium.Cartesian3();
	//Cesium.Cartesian3.add(positionPathToFollow[i],positionDeltaXYZ,thisPoint);

	//console.log("Entity position" + i + ": ");
	//console.log(thisPoint);

	positionProperty.addSample(time, thisPoint);
	//console.log("Path Point: " + thisPoint);

	nextTimeStep = time;
	// display position
      
	// viewer.entities.add({
	//   position: thisPoint,
	//   //name: text,
	//   point: { pixelSize: 10, color: Cesium.Color.GREEN }
	// });
    }
    //console.log("LOG 2 (animatePath):", new Date().toISOString());

    pEntity.position = positionProperty;
    // Orient balloon towards movement
    //console.log("**** changing orientation");
    pEntity.orientation = new Cesium.VelocityOrientationProperty(positionProperty); // ****
    
    // Change interpolation mode to make path more curved
    pEntity.position.setInterpolationOptions({
      interpolationDegree: 5,
      interpolationAlgorithm:
        Cesium.LagrangePolynomialApproximation,
    });

    //console.log("LOG 3 (animatePath):", new Date().toISOString());

    //let lastPositionCheckTime = Cesium.JulianDate.now();

    viewer.clock.onTick.addEventListener(function() {
      if (viewer.clock.shouldAnimate) {
        //console.log("LOG 4 (animatePath):", new Date().toISOString());
        const currentTime = viewer.clock.currentTime;
        //const elapsedTime = Cesium.JulianDate.secondsDifference(currentTime, lastPositionCheckTime);
        
        //if (elapsedTime >= 10) {
          //let positionAtTime = positionProperty.getValue(viewer.clock.currentTime);
        if(positionProperty.getValue(viewer.clock.currentTime) !== undefined) {
          //console.log("LOG 7 (animatePath):", new Date().toISOString());
          
          // let positionAtTime = roundPosition(positionProperty.getValue(viewer.clock.currentTime));
          // let finalPosition = roundPosition(positionPathToFollow[positionPathToFollow.length - 1]);

          let positionAtTime = positionProperty.getValue(viewer.clock.currentTime);
          let finalPosition = positionPathToFollow[positionPathToFollow.length - 1];

          //console.log("Position at time: " + positionAtTime);
          //console.log("Final position: " + finalPosition);

          //console.log("LOG 5: POSITON AT GIVEN TIME: " + positionAtTime + " at " + new Date().toISOString());
          
          //console.log("Position at given time: " + positionAtTime);
          //console.log("Final Position: " + finalPosition);
          
          
          if (Cesium.Cartesian3.equalsEpsilon(positionAtTime, finalPosition, epsilon)) {
            viewer.entities.remove(pEntity);
            pathEntitiesRemoved++;
            //console.log("Removed: " + pathEntitiesRemoved);
          }
          else{
            //console.log("Positions not equal");
          }

          //lastPositionCheckTime = currentTime;     
        }
        //}
      }
    });

    //console.log("LOG 6 (animatePath):", new Date().toISOString());

    // console.log("Sampled position: ");
    // console.log(positionProperty);
    
    //console.log("NUMBER OF ACTIVE ENTITIES: " + countActiveEntities());
    //console.log("ENTITY POSITIONS: ");
    //console.log(positionProperty);
    return positionProperty;
  }

async function animatePathMultiBoxUNUSED(pEntity,startingCoordXYZ,positionPathToFollow,positionDeltaRad, orientationStartingCoordXYZ,orientationPathToFollow) {
    // Create SampledPositionProperty
    //console.log("LOG 1 (animatePath):", new Date().toISOString());
    const positionProperty = new Cesium.SampledPositionProperty();
    const orientationPositionProperty = new Cesium.SampledPositionProperty();
    
    // Plot points on the map
    let pEntityStartTime = viewer.clock.currentTime;
    //positionProperty.addSample(pEntityStartTime, startPos); 
    
    //add first position
    positionProperty.addSample(pEntityStartTime, startingCoordXYZ);
    orientationPositionProperty.addSample(pEntityStartTime, orientationStartingCoordXYZ);
    //console.log(pEntity); // ****
    //positionProperty.addSample(pEntityStartTime, pEntity.position);
    
    //console.log("Path Point One: " + startingCoordXYZ)
    nextTimeStep = pEntityStartTime;
    
    for (let i=0; i<positionPathToFollow.length; i++) {
	const time = Cesium.JulianDate.addSeconds(nextTimeStep, TimeStepInSeconds * pathSpeed, new Cesium.JulianDate());

	const position_to_follow_rad = new Cesium.Cartographic.fromCartesian(positionPathToFollow[i]);
	const long_rad = position_to_follow_rad.longitude;
	const lat_rad  = position_to_follow_rad.latitude;
	const height   = position_to_follow_rad.height;

	const thisPoint = new Cesium.Cartesian3.fromRadians(long_rad+positionDeltaRad.y, lat_rad+positionDeltaRad.x, height);
	//const thisPoint = new Cesium.Cartesian3.fromRadians(long_rad, lat_rad, height);
	
	//console.log(`**** positionPathToFollow[${i}]:`, positionPathToFollow[i]);
	//console.log("**** positionDeltaXYZ:",positionDeltaXYZ);
	//const thisPoint = new Cesium.Cartesian3();
	//Cesium.Cartesian3.add(positionPathToFollow[i],positionDeltaXYZ,thisPoint);

	//console.log("Entity position" + i + ": ");
	//console.log(thisPoint);

	const oposition_to_follow_rad = new Cesium.Cartographic.fromCartesian(orientationPathToFollow[i]);
	const olong_rad = oposition_to_follow_rad.longitude;
	const olat_rad  = oposition_to_follow_rad.latitude;
	const oheight   = oposition_to_follow_rad.height;
	const othisPoint = new Cesium.Cartesian3.fromRadians(olong_rad, olat_rad, oheight);
	
	positionProperty.addSample(time, thisPoint);
	//console.log("Path Point: " + thisPoint);
	orientationPositionProperty.addSample(time, othisPoint);

	nextTimeStep = time;
	// display position
      
	// viewer.entities.add({
	//   position: thisPoint,
	//   //name: text,
	//   point: { pixelSize: 10, color: Cesium.Color.GREEN }
	// });
    }
    //console.log("LOG 2 (animatePath):", new Date().toISOString());

    pEntity.position = positionProperty;
    // Orient balloon towards movement
    //console.log("**** changing orientation");
    //pEntity.orientation = new Cesium.VelocityOrientationProperty(positionProperty); // ****
    pEntity.orientation = new Cesium.VelocityOrientationProperty(orientationPositionProperty);
    
    // Change interpolation mode to make path more curved
    pEntity.position.setInterpolationOptions({
      interpolationDegree: 5,
      interpolationAlgorithm:
        Cesium.LagrangePolynomialApproximation,
    });

    //console.log("LOG 3 (animatePath):", new Date().toISOString());

    //let lastPositionCheckTime = Cesium.JulianDate.now();

    viewer.clock.onTick.addEventListener(function() {
      if (viewer.clock.shouldAnimate) {
        //console.log("LOG 4 (animatePath):", new Date().toISOString());
        const currentTime = viewer.clock.currentTime;
        //const elapsedTime = Cesium.JulianDate.secondsDifference(currentTime, lastPositionCheckTime);
        
        //if (elapsedTime >= 10) {
          //let positionAtTime = positionProperty.getValue(viewer.clock.currentTime);
        if(positionProperty.getValue(viewer.clock.currentTime) !== undefined) {
          //console.log("LOG 7 (animatePath):", new Date().toISOString());
          
          // let positionAtTime = roundPosition(positionProperty.getValue(viewer.clock.currentTime));
          // let finalPosition = roundPosition(positionPathToFollow[positionPathToFollow.length - 1]);

          let positionAtTime = positionProperty.getValue(viewer.clock.currentTime);
          let finalPosition = positionPathToFollow[positionPathToFollow.length - 1];

          //console.log("Position at time: " + positionAtTime);
          //console.log("Final position: " + finalPosition);

          //console.log("LOG 5: POSITON AT GIVEN TIME: " + positionAtTime + " at " + new Date().toISOString());
          
          //console.log("Position at given time: " + positionAtTime);
          //console.log("Final Position: " + finalPosition);
          
          
          if (Cesium.Cartesian3.equalsEpsilon(positionAtTime, finalPosition, epsilon)) {
            viewer.entities.remove(pEntity);
            pathEntitiesRemoved++;
            //console.log("Removed: " + pathEntitiesRemoved);
          }
          else{
            //console.log("Positions not equal");
          }

          //lastPositionCheckTime = currentTime;     
        }
        //}
      }
    });

    //console.log("LOG 6 (animatePath):", new Date().toISOString());

    // console.log("Sampled position: ");
    // console.log(positionProperty);
    
    //console.log("NUMBER OF ACTIVE ENTITIES: " + countActiveEntities());
    //console.log("ENTITY POSITIONS: ");
    //console.log(positionProperty);
    return positionProperty;
  }

/* GET NEXT POINT */
// Get next point using wind data
async function getWindBlownNextPoint(originPoint) {
  // Wait for wind data
  let originDegrees = cartesianToDegrees(originPoint);
  
  //await fetchAndStoreWind(originDegrees.latitude, originDegrees.longitude); // ****    
  const weatherWind =  await fetchWeatherData(originDegrees.latitude, originDegrees.longitude);
  const windDirection = weatherWind.windDirection;
  const windSpeed     = weatherWind.windSpeed;
    
  // Convert wind direction to radians
  let windDirRad = Cesium.Math.toRadians(windDirection);
  // Calculate magnitude (distance)
  let magnitude = windSpeed * TimeStepInSeconds; // m/min
  // Calculate x and y coordinates
  let nextX = originPoint.x + Math.cos(windDirRad) * magnitude;
  let nextY = originPoint.y + Math.sin(windDirRad) * magnitude;
  // Make cartesian point on Cesium Map
  let nextPointCartesian = new Cesium.Cartesian3(nextX, nextY, originPoint.z);
  // Convert into cartographic
  let nextPointCartographic = Cesium.Cartographic.fromCartesian(nextPointCartesian);
  // Convert longitude and latitude to degrees
  let longitude = Cesium.Math.toDegrees(nextPointCartographic.longitude);
  let latitude = Cesium.Math.toDegrees(nextPointCartographic.latitude);
  // Create nextPoint
  let nextPoint = Cesium.Cartesian3.fromDegrees(longitude, latitude, DefaultFlyingAltitudeMeters); // Note: Hard-coded constant altitude

  // console.log("==============================================================");
  // console.log("Wind Speed: " + windSpeed);
  // console.log("Wind Direction(Degrees): " + windDirection);
  // console.log("Magnitude: " + magnitude);
  // console.log("Next point coords: (" + longitude + ", " + latitude + ")");
  // console.log("==============================================================");

  return nextPoint;
}


// Teleport to next location
async function teleportToCurrentCity()
{
  console.log("teleportToCurrentCity()");
    
  if (viewer != null) {
      // Reset position
      startTime = viewer.clock.currentTime;
      // Initialise nextTimeStep
      nextTimeStep = startTime;
      // Set clock settings
      viewer.clock.startTime = startTime.clone();
      viewer.clock.currentTime = startTime.clone();

      // Create wind path for next city in the list. Spawn balloon on that location.
      // ****
      const current_city_info = getCurrentCityInfo();
      const current_starting_coord_xyz = getCurrentStartingCoordXYZ();
      await createPath(BalloonSurrogateEntity, current_starting_coord_xyz, NumPathPoints, TimeStepInSeconds);
      //console.log(current_city_info.cityName);
      //reset clock
      viewer.clock.multiplier = 1;
      //viewer.clock.shouldAnimate = true;
  }

  if (viewer != null) {
      removeAllEntitiesByName("Path Entity");
      setTimeout(createPathEntity, 5000);

      viewer.trackedEntity = BalloonSurrogateEntity;
  }
}

/*********************************
 * ENTITIES
 *********************************/


//Create Path Entity
async function createPathEntity() {
    //console.log("createPathEntity()");

    console.log(`**** createPathEntity(): [currentCityIndexPos = ${JourneyItinerary.currentCityIndexPos}]`);
    console.log("**** randomStartingPoints: ", JSON.stringify(JourneyItinerary.startingCityPointsArray));

    const current_city_starting_coord_xyz = getCurrentStartingCoordXYZ();

    
    const pathEntity = viewer.entities.add({ 
	name: "Path Entity",
	// Move entity via simulation time
	
	availability: new Cesium.TimeIntervalCollection([
	    new Cesium.TimeInterval({
		start: viewer.clock.currentTime,
		stop: Cesium.JulianDate.addSeconds(viewer.clock.currentTime, TimeStepInSeconds * NumPathPoints, new Cesium.JulianDate()),
	    }),
	]),
	    
	position: current_city_starting_coord_xyz,

	    
	box : {
	    dimensions : new Cesium.Cartesian3(20, 6, 1),
	    material : Cesium.Color.WHITE,
	    outline : true,
	    outlineWidth : 3,	    
	    outlineColor : Cesium.Color.BLACK
	},
	
        // path: {
        //   resolution: 1,
        //   material: new Cesium.PolylineGlowMaterialProperty({
        //     glowPower: 0.1,
        //     color: Cesium.Color.BLUE,
        //   }),
        //   width: 15,
        // },
    });

    //console.log("LOG: Entity created at", new Date().toISOString());

    await animatePath(pathEntity,current_city_starting_coord_xyz,positionPathPointArray);
    
  //console.log("LOG: Path animation completed at", new Date().toISOString());
}


//Create Path Entity
async function createPathEntityPolygonUNUSED() {
    //console.log("createPathEntity()");

    console.log(`**** createPathEntity(): [currentCityIndexPos = ${JourneyItinerary.currentCityIndexPos}]`);
    console.log("**** randomStartingPoints: ", JSON.stringify(JourneyItinerary.startingCityPointsArray));

    const current_city_starting_coord_xyz = getCurrentStartingCoordXYZ();
    
    // Define key dimensions of array, in metres
    const arrowBodyLength = 20.0; 
    const arrowBodyWidth  =  6.0;  
    const arrowTipFlange  =  5.0;
    const arrowTipLength  = 10.0;
    
    let arrowPositions = [
	new Cesium.Cartesian3(-arrowBodyWidth/2,                    arrowBodyLength/2, 0),  // Body Bottom-left
	new Cesium.Cartesian3( arrowBodyWidth/2,                    arrowBodyLength/2, 0),  // Body Bottom-right
	new Cesium.Cartesian3( arrowBodyWidth/2,                   -arrowBodyLength/2, 0),  // Body Top-right
	new Cesium.Cartesian3( arrowBodyWidth/2 + arrowTipFlange,  -arrowBodyLength/2,                    0),  // Arrowhead Top-right
	new Cesium.Cartesian3(                                 0,  -(arrowBodyLength/2 + arrowTipLength), 0),  // Arrowhead Apex
	new Cesium.Cartesian3(-arrowBodyWidth/2 - arrowTipFlange,  -arrowBodyLength/2,                    0),  // Arrowhead Top-left
	new Cesium.Cartesian3(-arrowBodyWidth/2,                   -arrowBodyLength/2, 0)   // Body Top-left
    ];
    
    for (let arrowPosition of arrowPositions) {
	arrowPosition.x += current_city_starting_coord_xyz.x;
	arrowPosition.y += current_city_starting_coord_xyz.y;
	arrowPosition.z += current_city_starting_coord_xyz.z;
    }
    
    //let position = new Cesium.Cartesian3();
    //Cesium.Cartesian3.add(current_city_starting_coord_xyz,delta,position);

    const pathEntity = viewer.entities.add({ 
	name: "Path Entity",
	// Move entity via simulation time
	    
	availability: new Cesium.TimeIntervalCollection([
	    new Cesium.TimeInterval({
		start: viewer.clock.currentTime,
		stop: Cesium.JulianDate.addSeconds(viewer.clock.currentTime, TimeStepInSeconds * NumPathPoints, new Cesium.JulianDate()),
	    }),
	]),
	    
	//position: current_city_starting_coord_xyz,
	//position: position,
	/*
	    box : {
		dimensions : new Cesium.Cartesian3(20, 6, 1),
		material : Cesium.Color.BLUE,
		//outline : true,
		outlineColor : Cesium.Color.YELLOW
	    },
      */
          
        polygon: {
   	    //hierarchy: new Cesium.PolygonHierarchy(rectanglePositions),
	    hierarchy: arrowPositions,
	    material : Cesium.Color.WHITE,
	    perPositionHeight: true,
	    //height: 0,
	    outline : true,
	    outlineColor : Cesium.Color.BLACK,
	    outlineWidth : 3
	
        },
   
      
        // path: {
        //   resolution: 1,
        //   material: new Cesium.PolylineGlowMaterialProperty({
        //     glowPower: 0.1,
        //     color: Cesium.Color.BLUE,
        //   }),
        //   width: 15,
        // },
    });
    
    //console.log("LOG: Entity created at", new Date().toISOString());

    //await animatePath(pathEntity,position,positionPathPointArray,delta_rad, current_city_starting_coord_xyz,positionPathPointArray);

    //console.log("LOG: Path animation completed at", new Date().toISOString());
}


//Create Path Entity
async function createPathEntityMultiBoxesUNUSED() {
    //console.log("createPathEntity()");

    console.log(`**** createPathEntity(): [currentCityIndexPos = ${JourneyItinerary.currentCityIndexPos}]`);
    console.log("**** randomStartingPoints: ", JSON.stringify(JourneyItinerary.startingCityPointsArray));

    const current_city_starting_coord_xyz = getCurrentStartingCoordXYZ();
    const z_height = current_city_starting_coord_xyz.z;

    const delta_x_meters1 = 2.0;    
    const delta_y_meters1 = 5.0;    
    const delta_x_meters2 = 3.0;    
    const delta_y_meters2 = 3.0;    

    const x_delta_rad1 = delta_x_meters1 / z_height;
    const y_delta_rad1 = delta_y_meters1 / z_height;
    const x_delta_rad2 = delta_x_meters2 / z_height;
    const y_delta_rad2 = delta_y_meters2 / z_height;

    const delta_rads = [
	{ x: -x_delta_rad2, y: y_delta_rad2 },
	{ x: -x_delta_rad1, y: y_delta_rad1 },
	{ x:             0, y:            0 },
	{ x:  x_delta_rad1, y: y_delta_rad1 },
	{ x:  x_delta_rad2, y: y_delta_rad2 }
    ]

    
    // Define key dimensions of array, in metres
    const arrowBodyLength = 20.0; 
    const arrowBodyWidth  =  6.0;  
    const arrowTipFlange  =  5.0;
    const arrowTipLength  = 10.0;
    

    let arrowPositions = [
	new Cesium.Cartesian3(-arrowBodyWidth/2,                    arrowBodyLength/2, 0),  // Body Bottom-left
	new Cesium.Cartesian3( arrowBodyWidth/2,                    arrowBodyLength/2, 0),  // Body Bottom-right
	new Cesium.Cartesian3( arrowBodyWidth/2,                   -arrowBodyLength/2, 0),  // Body Top-right
	new Cesium.Cartesian3( arrowBodyWidth/2 + arrowTipFlange,  -arrowBodyLength/2,                    0),  // Arrowhead Top-right
	new Cesium.Cartesian3(                                 0,  -(arrowBodyLength/2 + arrowTipLength), 0),  // Arrowhead Apex
	new Cesium.Cartesian3(-arrowBodyWidth/2 - arrowTipFlange,  -arrowBodyLength/2,                    0),  // Arrowhead Top-left
	new Cesium.Cartesian3(-arrowBodyWidth/2,                   -arrowBodyLength/2, 0)   // Body Top-left
    ];
    
    for (let arrowPosition of arrowPositions) {
	arrowPosition.x += current_city_starting_coord_xyz.x;
	arrowPosition.y += current_city_starting_coord_xyz.y;
	arrowPosition.z += current_city_starting_coord_xyz.z;
    }
    
    const boxes = [ 
	{
	    dimensions : new Cesium.Cartesian3( 3, 1, 1),
	    material : Cesium.Color.WHITE,
	    //outline : true,
	    //outlineColor : Cesium.Color.YELLOW
	},
	{
	    dimensions : new Cesium.Cartesian3( 8, 1, 1),
	    material : Cesium.Color.WHITE,
	    //outline : true,
	    //outlineColor : Cesium.Color.YELLOW
	},	
	{
	    dimensions : new Cesium.Cartesian3(20, 3, 1),
	    material : Cesium.Color.WHITE,
	    //outline : true,
	    //outlineColor : Cesium.Color.YELLOW
	},
	{
	    dimensions : new Cesium.Cartesian3( 8, 1, 1),
	    material : Cesium.Color.WHITE,
	    //outline : true,
	    //outlineColor : Cesium.Color.YELLOW
	},	
	{
	    dimensions : new Cesium.Cartesian3( 3, 1, 1),
	    material : Cesium.Color.WHITE,
	    //outline : true,
	    //outlineColor : Cesium.Color.YELLOW
	}
    ];

    const current_city_starting_cartographic_rad = Cesium.Cartographic.fromCartesian(current_city_starting_coord_xyz);
    const long_rad = current_city_starting_cartographic_rad.longitude;
    const lat_rad  = current_city_starting_cartographic_rad.latitude;
    const height   = current_city_starting_cartographic_rad.height;

    /*
    const positions = [
	new Cesium.Cartesian3.fromRadians(long_rad+y_delta_rad2,    lat_rad-x_delta_rad2, height),
	new Cesium.Cartesian3.fromRadians(long_rad+y_delta_rad1,    lat_rad-x_delta_rad1, height),
	new Cesium.Cartesian3.fromRadians(             long_rad,                 lat_rad, height),
	new Cesium.Cartesian3.fromRadians(long_rad+y_delta_rad1,    lat_rad+x_delta_rad1, height),
	new Cesium.Cartesian3.fromRadians(long_rad+y_delta_rad2,    lat_rad+x_delta_rad2, height)
    ];

    console.log("**** positions: ", JSON.stringify(positions));
    */
    
    /*
    const deltas = [
	new Cesium.Cartesian3( -6, 5, 0),
	new Cesium.Cartesian3(  0, 0, 0),
	new Cesium.Cartesian3(  6, 5, 0)	
    ];
    */
    

    for (let i=0; i<boxes.length; i++) {

	if (i != 2) { continue; }
	
	const box = boxes[i];
	//const delta = deltas[i];

	//let position = new Cesium.Cartesian3();
	//Cesium.Cartesian3.add(current_city_starting_coord_xyz,delta,position);

	//const position = positions[i];

	const delta_rad = delta_rads[i];
	const position = new Cesium.Cartesian3.fromRadians(long_rad+delta_rad.y, lat_rad+delta_rad.x, height);

	console.log(`**** position[${i}] = `, position);
	const pathEntity = viewer.entities.add({ 
	    name: "Path Entity",
	    // Move entity via simulation time
	    
	    availability: new Cesium.TimeIntervalCollection([
		new Cesium.TimeInterval({
		    start: viewer.clock.currentTime,
		    stop: Cesium.JulianDate.addSeconds(viewer.clock.currentTime, TimeStepInSeconds * NumPathPoints, new Cesium.JulianDate()),
		}),
	    ]),
	    
	    //position: current_city_starting_coord_xyz,
	    position: position,
/*	    
	    box : {
		dimensions : new Cesium.Cartesian3(20, 6, 1),
		material : Cesium.Color.BLUE,
		//outline : true,
		outlineColor : Cesium.Color.YELLOW
	    },
  */    
	    box: box,
      
/*    
         polygon: {
   	    //hierarchy: new Cesium.PolygonHierarchy(rectanglePositions),
	    hierarchy: arrowPositions,
	    material : Cesium.Color.WHITE,
	    perPositionHeight: true,
	    //height: 0,
	    outline : true,
	    outlineColor : Cesium.Color.BLACK,
	    outlineWidth : 3
	
        },
  */    
      
        // path: {
        //   resolution: 1,
        //   material: new Cesium.PolylineGlowMaterialProperty({
        //     glowPower: 0.1,
        //     color: Cesium.Color.BLUE,
        //   }),
        //   width: 15,
        // },
	});

	//console.log("LOG: Entity created at", new Date().toISOString());

	await animatePathMultiBoxes(pathEntity,position,positionPathPointArray,delta_rad, current_city_starting_coord_xyz,positionPathPointArray);

    }
    
  //console.log("LOG: Path animation completed at", new Date().toISOString());
}


function generateAnimatedPath(){
  //console.log("generate method called");
  if(viewer.clock.shouldAnimate){
    console.log("clock animated");
    createPathEntity();
  }
}
//first path entity - called only once
//NOTE: if clock is started as soon as program is loaded this entity gets removed
//  wait a few seconds for game to load or increase the setTimeout time
// ****
//console.warn("Warning: **** Supressing setTimeout(createPathEntity,4000), as there are no valid city co-ords when called at this point ")
//setTimeout(createPathEntity, 4000);

// Set up the onTick event listener
if (viewer != null) {
    viewer.clock.onTick.addEventListener(function(clock) {
	// Calculate the elapsed time since the last call to generatePath
	const elapsedTime = Cesium.JulianDate.secondsDifference(clock.currentTime, lastGeneratePathTime);
	
	// Check if the defined interval has passed since the last call
	if (elapsedTime >= pathEntityInterval) {
	    // Call generatePath
	    generateAnimatedPath();
	    
	    // Update the lastGeneratePathTime to the current time
	    lastGeneratePathTime = clock.currentTime;
	}
    });
}

// Count active entities
function countActiveEntities() {
  let activeCount = 0;
  viewer.entities.values.forEach(function(entity) {
      if (entity.isShowing) {
          activeCount++;
      }
  });
  return activeCount;
}

function removeAllEntitiesByName(entityName) {
  let entities = viewer.entities.values;

  for (let i = entities.length - 1; i >= 0; i--) {
    if (entities[i].name === entityName) {
      viewer.entities.remove(entities[i]);
    }
  }
}

//Set up chase camera
let matrix3Scratch = new Cesium.Matrix3();
let positionScratch = new Cesium.Cartesian3();
let orientationScratch = new Cesium.Quaternion();
let scratch = new Cesium.Matrix4();

function getModelMatrix(balloon, time, result) {
  let position = Cesium.Property.getValueOrUndefined(balloon.position, time, positionScratch);
  if (!Cesium.defined(position)) {
    return undefined;
  }
 let orientation = Cesium.Property.getValueOrUndefined(balloon.orientation, time, orientationScratch);
  if (!Cesium.defined(orientation)) {
    result = Cesium.Transforms.eastNorthUpToFixedFrame(position, undefined, result);
  } else {
    result = Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromQuaternion(orientation, matrix3Scratch), position, result);
  }
  return result;
}

// Following feature nolonger used
/*
// Generate path for the balloon
const nextCityButton = document.getElementById("next-city");
nextCityButton.addEventListener('click', teleportToCurrentCity);
*/



/*********************************
 * COMPASS Widget (<div>)
 *********************************/

let compass = null;

if (viewer != null) {
    // Create a compass element
    compass = document.createElement('div');
    compass.className = 'cesium-compass';
    viewer.container.appendChild(compass);
    //set to north
    compass.style.transform = 360 - Cesium.Math.toDegrees( viewer.camera.heading );

    // Update compass orientation when camera changes
    viewer.scene.postRender.addEventListener(function() {
	const camera = viewer.camera;
	const heading = Cesium.Math.toDegrees(camera.heading).toFixed(1);
	compass.style.transform = 'rotate(' + (-heading) + 'deg)';
    });


    // CSS styles for the compass
    let style = document.createElement('style');
    style.textContent = `
      .cesium-compass {
        position: absolute;
        bottom: 40px;
        right: 40px;
        width: 100px;
        height: 100px;
        background-image: url('compass.png'); /* Image for the compass needle */
        background-size: contain;
        transition: transform 0.5s;
    }`;
    document.head.appendChild(style);
}


/*********************************
 * TIMER
 *********************************/
let minutesText = document.getElementById("minutes");
let secondsText = document.getElementById("seconds");

function startTimer(duration) {
    let timer_duration = duration;
    //let minutes, seconds;  ****

  setInterval(function () {
    // Calculate time to display
    let minutes = parseInt(timer_duration / 60, 10);
    let seconds = parseInt(timer_duration % 60, 10);

    // Add 0 if less than 10
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;

    // Display on span
    minutesText.innerText = minutes;
    secondsText.innerText = seconds;

    // Change colour to red if timer_duration has 10 seconds left
    if(timer_duration <= 10) {
      minutesText.style.color = '#ff0000';
      secondsText.style.color = '#ff0000';
    } else {
      minutesText.style.color = '#ffffff';
      secondsText.style.color = '#ffffff';
    }

    // When timer ends
    if (--timer_duration < 0) {
      // Reset duration
      timer_duration = duration;
      // Call nextCity
      //teleportToCurrentCity();
    }
  }, 1000);
}

// Start 2 minute timer
//startTimer(60 * 1);

/*********************************
 * Runtime Code: Callback/Listeners
 *********************************/

if (viewer != null) {
    // Tick function
    viewer.clock.onTick.addEventListener(function(clock) {
	// If clock is playing
	if(clock.shouldAnimate) {
	    // Change camera angle to 3rd person view (chase cam, no camera controls)
	    //getModelMatrix(BalloonSurrogateEntity, viewer.clock.currentTime, scratch);
	    //cam.lookAtTransform(scratch, new Cesium.Cartesian3(-250, 0, 70));
	   
	    // Track balloon (with camera controls)
	    viewer.trackedEntity = BalloonSurrogateEntity;	    
	}
    });

    // On Pause/Play event
    Cesium.knockout.getObservable(viewer.animation.viewModel.clockViewModel, 'shouldAnimate')
	.subscribe(function(value) {
	    // If paused
	    if (!value) {
		// Revert camera back to normal
		viewer.zoomTo(BalloonSurrogateEntity, cameraOffset);
	    }
	});
}


// https://stackoverflow.com/questions/979975/get-the-values-from-the-get-parameters-javascript
function joinRoomShortcut()
{
    const join_name = window.location.searchParams.get("name");
    const join_room = window.location.searchParams.get("room");

    if ((join_name && join_name.match(/[^\s]/)) && (join_room && join_room.match(/[^\s]/))) {
	console.log(`Add code here for joining ${join_name} to room ${join_room}`);	
    }   
}
