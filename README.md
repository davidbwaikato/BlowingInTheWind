# Blowing In The Wind

COMPX241 Smoke and Mirrors Project: A geo-guessing game based around a
hot air balloon simulator using real world weather and mapping data


## Installation/Setup

If your command-line environment does not already have NodeJS installed:

```
  cd nodejs-for-bitw/
  ./GET-NODEJ.sh
  cd ..
```

First time setup, you might also want to make sure your _npm_ is the most
up to date:
```
  npm update npm
```

Next, copy SETUP.bash.in to SETUP.bash, and edit the values it contains
to match your setup.  You will need to acquire API keys for Cesium
and the Weather API.

By default the installation is configured to run over http://localhost.
Port 3001 for ther server, and Port 3002 for the React Client App.
Refer to the BITW_* environment variables in SETUP.bash if installing
Blowwing In The Wind to operate through a ReverseProxy web server
such as Apache2

```
  cp -i SETUP.bash.in SETUP.bash
  # Then edit the file, for example with emacs
  emacs SETUP.bash
```

Now follow the instructions in the README.md files in _server_ and _client_.


