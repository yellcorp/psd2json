# psd2json

Exports the layers in a Photoshop document to a set of PNG files, plus a JSON
file describing each layer's name, position, size, blend mode, among others.

To use, first build the TypeScript:

```
npm run build
```

Then in Photoshop, open the document you want to export, or activate its
window if it's already open. Choose File ] Scripts ] Browse… then select
`psd2json.jsx` in the root of this repo. A file dialog will open,
prompting you for a location to save the JSON file. Layer PNGs will be
saved to the same folder as the JSON.

## License

Copyright (c) 2024 Jim Boswell.  Licensed under the Expat MIT license.  See the
file LICENSE for the full text.
