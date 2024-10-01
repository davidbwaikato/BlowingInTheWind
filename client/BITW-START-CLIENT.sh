#!/bin/bash

if [ "x$BITW_HOME" = "x" ] ; then
    cd .. && source ./SETUP.bash && cd client
fi

echo "**** HOME=$BITW_HOME"

PORT=$BITW_CLIENT_PORT WDS_SOCKET_PORT=$BITW_SERVER_WDS_SOCKET_PORT npm run start
