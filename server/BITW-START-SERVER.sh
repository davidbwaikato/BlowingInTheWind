#!/bin/bash

if [ "x$BITW_HOME" = "x" ] ; then
    cd .. && source ./SETUP.bash && cd server
fi

npm run start
