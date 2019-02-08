# server using macOS cli tool "fswatch" and npm mustache to render all into
#  index.html using config_UI.json and base.html and all items inside partials/

fswatch * | while read;     do   `test="mustache config_UI.json base.html index.html ";for f in partials/*; do test="$test -p $f"; done; $test`    || true;     done
