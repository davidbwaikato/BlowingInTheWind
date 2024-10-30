
// Hard-wired list of cities (for now)
//
// Potential to be expanded into using CSV data from:
//   simplemaps_worldcities_basicv1.77.zip

const CitiesArray = [
    { city: "Auckland",      country: "New Zealand", coordinates: [ 174.763336,  -36.848461, 300.0]},
    { city: "Rome",          country: "Italy",       coordinates: [  12.496366,   41.902782, 300.0]},
    { city: "Paris",         country: "France",      coordinates: [   2.349014,   48.864716, 300.0]},
    { city: "Tokyo",         country: "Japan",       coordinates: [ 139.817413,   35.672855, 300.0]},
    { city: "Dubai",         country: "United Arab Emirates",            coordinates: [  55.296249,   25.276987, 300.0]},
    { city: "Hamilton",      country: "New Zealand", coordinates: [ 175.269363,  -37.781528, 300.0]},
    { city: "Toronto",       country: "Canada",      coordinates: [ -79.384293,   43.653908, 300.0]},
    { city: "Sydney",        country: "Australia",   coordinates: [ 151.209900,  -33.865143, 300.0]},
    { city: "San Francisco", country: "USA",         coordinates: [-122.431297,   37.773972, 300.0]},
    { city: "New York",      country: "USA",         coordinates: [ -73.935242,   40.730610, 300.0]},
    //{ city: "Seoul",         country: "South Korea", coordinates: [ 127.024612,   37.532600, 300.0]},
    //{ city: "New Delhi",     country: "India",       coordinates: [  77.216721,   28.644800, 300.0]},
    { city: "Barcelona",     country: "Spain",       coordinates: [   2.154007,   41.390205, 300.0]},
    { city: "Athens",        country: "Greece",      coordinates: [  23.727539,   37.983810, 300.0]},
    { city: "Budapest",      country: "Hungary",     coordinates: [  19.040236,   47.497913, 300.0]},
    { city: "Moscow",        country: "Russia",      coordinates: [  37.618423,   55.751244, 300.0]},
    { city: "Cairo",         country: "Egypt",       coordinates: [  31.233334,   30.033333, 300.0]},
    { city: "Copenhagen",    country: "Denmark",     coordinates: [  12.568337,   55.676098, 300.0]},
    { city: "London",        country: "England",     coordinates: [  -0.118092,   51.509865, 300.0]},
] 


module.exports = { CitiesArray };
