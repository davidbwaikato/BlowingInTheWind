full_setup="$PWD/${BASH_SOURCE}"
fulldir=${full_setup%/*}
fulldir=${fulldir%/.}

. $fulldir/VERSION-INFO.bash

export NODE_PATH="$fulldir/$nodejs_for_proj/lib/node_modules"
export PATH="$fulldir/$nodejs_for_proj/bin:$PATH"

echo "Set NODE_PATH and updated PATH"
