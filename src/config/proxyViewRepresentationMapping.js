const View3D = {
  vtkPolyData: { name: 'Geometry' },
  vtkTubeGroup: { name: 'TubeGroup' },
  vtkImageData: { name: 'Volume' },
  vtkLabelMap: { name: 'LabelMapVolume' },
  vtkMolecule: { name: 'Molecule' },
  Glyph: { name: 'Glyph' },
  Skybox: { name: 'Skybox' },
};

const View2D = {
  vtkPolyData: { name: 'Geometry' },
  vtkTubeGroup: { name: 'TubeGroup' },
  vtkImageData: { name: 'Slice' },
  vtkLabelMap: { name: 'LabelMapSlice' },
  vtkMolecule: { name: 'Molecule' },
  Glyph: { name: 'Glyph' },
  Skybox: { name: 'Skybox' },
};

export default {
  View2D,
  View3D,
};
