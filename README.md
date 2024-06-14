# VSCode Custom Local Formatters

With this  extension you can add scripts to your formatter that will be run afterwards.  
So for example if you have selected clang-format for C/C++ files, you can add a python script that is run on the output of clang-format, to add some very specialised formattting style that clang-format does not allow out of the box.

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
         "languages": ["cpp"]
       }
     ]
   ```

3. That's it! Your script is now integrated with VSCode as an official formatter.
   You can now format your code though the Format Document command (`shift+alt+f`), enable the `editor.formatOnSave` option, or use the formatter however else VSCode allows.

## Copyright Note

This extension lets you run a user defined script to format your files.  
It is based on <https://marketplace.visualstudio.com/items?itemName=jkillian.custom-local-formatters>
