#!/bin/bash

. ./VERSION-INFO.bash

if [ -d "$nodejs_for_proj" ] ; then
   echo "Detected directory: '$nodejs_for_proj'.  Installation already setup"
   exit 1
fi

if [ ! -f "$nodejs_full_ver_tarfile" ] ; then
    wget "https://nodejs.org/dist/v$nodejs_version/$nodejs_full_ver_tarfile"
fi


if [ ! -d "$nodejs_full_ver" ] ; then
    tar xvf "$nodejs_full_ver_tarfile"
fi

/bin/mv "$nodejs_full_ver" "$nodejs_for_proj"

