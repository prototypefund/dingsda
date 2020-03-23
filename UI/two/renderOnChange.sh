# server using macOS cli tool "fswatch" and npm mustache to render all into
#  index.html using config_UI.json and base.html and all items inside partials/
#  also uses partials/ and phonegap_partials/ to build index_phonegap.html as well

fswatch * | while read;     
do   `test="mustache config_UI.json base.html index.html ";
for f in partials/*; do test="$test -p $f"; done; $test; 

pg="mustache config_UI.json base.html index_phonegap.html ";
for f in partials/*; do pg="$pg -p $f"; done; 
for f in phonegap_partials/*; do pg="$pg -p $f"; done; $pg`    || true;     done;
