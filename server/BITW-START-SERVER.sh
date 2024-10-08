#!/bin/bash

if [ "x$BITW_HOME" = "x" ] ; then
    cd .. && source ./SETUP.bash && cd server
fi

client_dir="../client"
build_dir="$client_dir/build"

# Check build_dir exists and up to date, otherwise issue a warning
if [ ! -d $build_dir ] ; then
    echo "===="
    echo "Warning: Did not detect '$build_dir'"
    echo ""
    echo "To operate BITW, this means the client's developer mode server"
    echo "needs to be running"
    echo "===="
else

    # Are any files in $client_dir/{public,src} newer than the newest file found in $build_dir?

    # Find the newest file in $build_dir
    newest_file_build_dir=$(find "$build_dir" -type f -exec stat --format='%Y %n' {} + | sort -n | tail -1 | cut -d' ' -f2-)

    # Check if any file in $client_dir is newer than the newest file in $build_dir
    newer_files=$(find "$client_dir/public" "$client_dir/src" -type f -newer "$newest_file_build_dir")

    if [ -n "$newer_files" ]; then
	echo "===="
	echo "Warning: Newer source files detected in '$client_dir/{public,src}' than in '$build_dir'"
	echo ""
	echo "To operate BITW, either regeneate the client build directory or else"
	echo "run the client's developer mode server"
	echo "===="
    fi
fi

npm run start
