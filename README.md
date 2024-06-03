# VSCode Custom Local Formatters

Lets users add formatters to VSCode that run locally defined scripts.

## Motivation

This extension lets you run a user defined script to format your files.  
It is based on https://marketplace.visualstudio.com/items?itemName=jkillian.custom-local-formatters


## Quickstart

0. Install this extension

1. Define your custom formatting script.
   Scripts will receive the contents of the file to be formatted over STDIN.
   They should output the formatted results over STDOUT.
  
2. Configure the extension to run your script on files of the right type.
   The script will be run with a working directory of the workspace root.
   Valid language identifiers [can be found here](https://code.visualstudio.com/docs/languages/identifiers).

   ```json
     "customLocalFormatters.formatters": [
       {
         "command": "python format-yml-files.py",
         "languages": ["yml"]
       }
     ]
   ```

3. That's it! Your script is now integrated with VSCode as an official formatter.
   You can now format your code though the Format Document command (`shift+alt+f`), enable the `editor.formatOnSave` option, or use the formatter however else VSCode allows.
