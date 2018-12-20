fswatch * | while read;     do   `test="mustache config_UI.json base.html index.html ";for f in partials/*; do test="$test -p $f"; done; $test`    || true;     done
