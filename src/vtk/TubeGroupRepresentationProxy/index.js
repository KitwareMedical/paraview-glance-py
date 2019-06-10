import macro from 'vtk.js/Sources/macro';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkGeometryRepresentationProxy from 'vtk.js/Sources/Proxy/Representations/GeometryRepresentationProxy';

// ----------------------------------------------------------------------------
// vtkTubeGroupRepresentationProxy methods
// ----------------------------------------------------------------------------

function vtkTubeGroupRepresentationProxy(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkTubeGroupRepresentationProxy');

  // override setColorBy implementation
  publicAPI.setColorBy = (arrayName, arrayLocation) => {
    const colorByArrayName = arrayName;
    const colorMode = vtkMapper.ColorMode.DIRECT_SCALARS;
    const scalarMode =
      arrayLocation === 'pointData'
        ? vtkMapper.ScalarMode.USE_POINT_FIELD_DATA
        : vtkMapper.ScalarMode.USE_CELL_FIELD_DATA;
    const scalarVisibility = true;

    model.mapper.set(
      {
        colorByArrayName,
        colorMode,
        scalarMode,
        scalarVisibility,
        useLookupTableScalarRange: false,
        interpolateScalarsBeforeMapping: false,
      },
      true // not all mappers have the above fields
    );
  };

  model.sourceDependencies = model.sourceDependencies.map((dep) => ({
    setInputData: (tubeGroup) => dep.setInputData(tubeGroup.getPolyData()),
  }));
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Object methods
  vtkGeometryRepresentationProxy.extend(publicAPI, model);

  // Object specific methods
  vtkTubeGroupRepresentationProxy(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkTubeGroupRepresentationProxy'
);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
