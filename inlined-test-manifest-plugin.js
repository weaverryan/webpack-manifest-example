/*
 * A simplified example of what webpack-manifest-plugin does
 */
const path = require('path')
const fs = require('fs');
const NormalModule = require('webpack/lib/NormalModule');

class WebpackManifestPlugin {
  apply(compiler) {
    const moduleAssets = {};
    const assetTypeModuleAssets = {};
    const manifestFileName = path.resolve(compiler.options.output.path, 'manifest.json');


    /*
     * Hook #1: collect "source" information about assets, both via
     *          file-loader and "asset modules"
     */
    compiler.hooks.compilation.tap({ name: 'WebpackManifestPlugin', stage: Infinity}, (compilation) => {
      NormalModule.getCompilationHooks(compilation).loader.tap({
        name: 'WebpackManifestPlugin',
        stage: Infinity
      }, (loaderContext, module) => {
        const { emitFile } = loaderContext;

        // the "emitFile" callback is never called on asset modules
        // so, we create a different map that can be used later in the "emit" hook
        if (['asset', 'asset/inline', 'asset/resource', 'asset/source'].includes(module.type)) {
          // This takes the userRequest (which is an absolute path) and turns it into
          // a relative path to the root context. This is done so that the string
          // will match asset.info.sourceFilename in the emit hook.
          let sourceFilename = path.relative(loaderContext.rootContext, module.userRequest);
          // at this point, Windows paths use \ in their paths
          // but in the emit hook, asset.info.sourceFilename fill have UNIX slashes
          sourceFilename = sourceFilename.replace(/\\/g, '/');
          Object.assign(assetTypeModuleAssets, {
            [sourceFilename]: path.basename(module.userRequest)
          });
        }

        // this relies on file-loader, which calls emitFile()
        loaderContext.emitFile = (file, content, sourceMap) => {
          if (module.userRequest && !moduleAssets[file]) {
            Object.assign(moduleAssets, {[file]: path.join(path.dirname(file), path.basename(module.userRequest))});
          }

          return emitFile.call(module, file, content, sourceMap);
        };
      })
    });

    /*
     * Hook #2: collect all output files and try to get their original filename
     */

    compiler.hooks.thisCompilation.tap(
      { name: 'WebpackManifestPlugin', stage: Infinity },
      (compilation) => {

        compilation.hooks.processAssets.tap(
          { name: 'WebpackManifestPlugin', stage: Infinity },
          () => writeManifestFile(compiler, compilation, moduleAssets, assetTypeModuleAssets, manifestFileName)
        );
      }
    );
  }
}

const writeManifestFile = (compiler, compilation, moduleAssets, assetTypeModuleAssets, manifestFileName) => {
  const stats = compilation.getStats().toJson({
    all: false,
    assets: true,
    cachedAssets: true,
    ids: true,
    publicPath: true
  });

  const auxiliaryFiles = {};
  let files = [];
  Array.from(compilation.chunks).forEach((chunk) => {
    // auxiliary files contain things like images, fonts AND, most
    // importantly, other files like .map sourcemap files
    // we modify the auxiliaryFiles array so that we can add any of these
    // to the manifest that was not added by another method
    // (sourcemaps files are not added via any other method)
    // the "path" here will be the final, built path - e.g. main.abcd123.png
    Array.from(chunk.auxiliaryFiles || []).forEach((auxiliaryFile) => {
      auxiliaryFiles[auxiliaryFile] = {
        path: auxiliaryFile,
        name: path.basename(auxiliaryFile),
      };
    });

    // collect the actual chunk files (in practice .js and .css files)
    Array.from(chunk.files).forEach((filePath) => {
      let name = chunk.name ? chunk.name : null;
      // chunk name, or for nameless chunks, just map the files directly.
      name = name ? `${name}.${getFileType(filePath)}` : filePath;

      files.push({
        path: filePath,
        name,
      });
    });
  })

  // assets only show up so far as auxiliary assets, but that is only their
  // final filename, with no map back to their original filename
  // by looping over assets, we can info about the source filename
  stats.assets.forEach((asset) => {
    let name;
    if (moduleAssets[asset.name]) {
      name = moduleAssets[asset.name];
    } else if (assetTypeModuleAssets[asset.info.sourceFilename]) {
      // asset.info.sourceFilename is mysteriously missing sometimes on Windows
      name = path.join(path.dirname(asset.name), assetTypeModuleAssets[asset.info.sourceFilename]);
    } else {
      name = asset.info.sourceFilename;
    }

    if (name) {
      files.push({
        path: asset.name,
        name,
      });
    }
  });

  // auxiliary files are "extra" files that are probably already included
  // in other ways. Loop over files and remove any from auxiliaryFiles
  files.forEach((file) => {
    delete auxiliaryFiles[file.path];
  });
  // if there are any auxiliaryFiles left, add them to the files
  // this handles, specifically, sourcemaps
  Object.keys(auxiliaryFiles).forEach((auxiliaryFile) => {
    files = files.concat(auxiliaryFiles[auxiliaryFile]);
  });

  files = files.map((file) => {
    const changes = {
      name: file.name,
      // an example of how we might prefix the path with the "publicPath"
      path: '/dist/' + file.path,
    };

    return Object.assign(file, changes);
  });

  const manifest = files.reduce(
    (manifest, file) => Object.assign(manifest, {[file.name]: file.path}),
    {}
  );

  const output = JSON.stringify(manifest, null, 2);
  fs.mkdirSync(path.dirname(manifestFileName), { recursive: true });
  fs.writeFileSync(manifestFileName, output);
}

const getFileType = (fileName) => {
  const replaced = fileName.replace(/\?.*/, '');
  const split = replaced.split('.');
  const extension = split.pop();
  return /^(gz|map)$/i.test(extension) ? `${split.pop()}.${extension}` : extension;
};

module.exports = WebpackManifestPlugin;
