import macro from 'vtk.js/Sources/macro';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';

// ----------------------------------------------------------------------------
// vtkTubeGroup methods
// ----------------------------------------------------------------------------

function vtkTubeGroup(publicAPI, model) {
  if (model.polyData && model.polyData.getClassName() === 'vtkPolyData') {
    publicAPI.shallowCopy(model.polyData);
    // do not keep a reference to it
    model.polyData = null;
  }

  // Set our className AFTER shallow copying the polydata
  // This is a workaround to shallowCopy()
  model.classHierarchy.push('vtkTubeGroup');
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  polyData: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkPolyData.extend(publicAPI, model);

  // Object specific methods
  vtkTubeGroup(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkTubeGroup');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
