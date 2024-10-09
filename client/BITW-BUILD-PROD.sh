#!/bin/bash

if [ "x$BITW_HOME" = "x" ] ; then
    cd .. && source ./SETUP.bash && cd client
fi


npm run build


echo "===="
echo "Production code output to:"
echo "    build/"
echo ""
echo "This is the directory the BITW server sets as the"
echo "root directory it references for static content"
echo "===="
