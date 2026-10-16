# Réglages des effets de Paint.NET 5.1 (référence)

Extrait automatiquement de l'installation locale de Paint.NET (IL désassemblé par `ildasm`,
libellés français officiels). Sert à aligner les dialogues d'effets de MasterPaint.
Régénérer : voir `tools/pdn-import/`.

## Adoucir le portrait  (`SoftenPortraitGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Douceur | Double | 5 | 0 | 10 |  |
| Éclairage | Int32 | 0 | -20 | 20 |  |
| Ton | Int32 | 10 | 0 | 20 |  |

## Ajouter du bruit  (`AddNoiseGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Intensité | Int32 | 64 | 0 | 100 |  |
| Saturation de la couleur | Int32 | 100 | 0 | 400 |  |
| Dispersion | Double | 100 | 0 | 100 |  |
| Seed | Int32 | 0 | 0 | 255 | IncrementButton bouton « Randomiser » |

## Améliorer la netteté  (`SharpenGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Valeur  | Double | 2 | 0 | 10 |  |
| Seuil | Double | 0 | 0 | 1 | échelle exp. |

## BokehBlurGpuEffect  (`BokehBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Double | 25 | 0 | <BokehBlurEffect.get_RadiusMax> | échelle exp. |
| Augmentation du gamma | Double | 0 | -0.99 | 2 | échelle exp. |
| Qualité | Int32 | 3 | 1 | <BokehBlurEffect.get_QualityMax> |  |

## Bosse  (`BulgeGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Bosse | Double | 0.45 | -3 | 1 |  |
| Centrage | DoubleVector | ('obj', 'Vector2Double'), ('obj', 'Vector2Double'), ('obj', 'Vector2Double') |  |  |  |
| BorderEdgeMode | StaticListChoice | Clamp | choix : Clamp, Wrap, Mirror, Transparent |  |  |
| Qualité | Int32 | None | None | None |  |

## BrightnessContrastGpuEffect  (`BrightnessContrastGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Luminosité | Int32 | 0 | -100 | 100 |  |
| Contraste | Int32 | 0 | -100 | 100 |  |

## Cabossage  (`DentsGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Échelle | Double | 25 | 0 | 200 | échelle exp. |
| Réfraction | Double | 50 | 0 | 200 | échelle exp. |
| Détail | Double | 10 | 0 | 100 |  |
| Turbulence | Double | 10 | 0 | 100 | échelle exp. |
| Angle | Double | 0 | -180 | 180 | AngleChooser |
| Qualité | Int32 | None | None | None |  |
| Seed | Int32 | 0 | 0 | 255 | IncrementButton bouton « Randomiser » |

## Contour  (`OutlineGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Épaisseur | Int32 | 3 | 1 | 70 |  |
| Intensité | Int32 | 50 | 0 | 100 |  |
| Qualité | Int32 | 8 | 1 | None |  |

## Cristallisation  (`CrystalizeGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Taille de cellule | Int32 | 8 | 2 | 250 |  |
| Qualité | Int32 | None | None | None |  |
| Seed | Int32 | 0 | 0 | 255 | IncrementButton bouton « Randomiser » |

## Croquis au crayon  (`PencilSketchGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Épaisseur du crayon | Double | 2 | 1 | 20 |  |
| Étendue  | Double | 0 | -20 | 20 |  |

## Croquis à l'encre  (`InkSketchGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Contour à l'encre | Int32 | 50 | 0 | 99 |  |
| Coloriage | Int32 | 50 | 0 | 100 |  |

## Détection des bords  (`EdgeDetectGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Intensité | Double | 0.5 | 0 | 1 |  |
| Flou | Double | 0 | 0 | 10 | échelle exp. |
| OverlayEdges | Boolean | 0 |  |  |  |

## Embosser  (`EmbossGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Angle | Double | 0 | 0 | 360 | AngleChooser |

## Exposition  (`ExposureGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Exposure | Int32 | 0 | 4294967096 | 200 |  |

## Faire pivoter / Zoomer  (`RotateZoomGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Retourner / Faire pivoter | DoubleVector3 | ('obj', 'Vector3Double'), ('obj', 'Vector3Double'), ('obj', 'Vector3Double') |  |  | RollBallAndSliders |
| Panoramique | DoubleVector | ('obj', 'Vector2Double'), ('obj', 'Vector2Double'), ('obj', 'Vector2Double') |  |  |  |
| Zoom | Double | 1 | 0.06 | 16 | échelle exp. |
| Qualité | Int32 | None | None | None |  |
| TilingMode | StaticListChoice | Transparent | choix : Transparent, Wrap, Mirror |  | DropDown |

## Flou carré  (`SquareBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Double | 6 | 0 | 300 | échelle exp. |
| Augmentation du gamma | Double | 0 | -0.99 | 2 | échelle exp. |

## Flou d'esquisse  (`SketchBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Double | 25 | 0 | 100 |  |
| Percentile | Int32 | 50 | 0 | 100 |  |
| Lissage | Int32 | 3 | 1 | 20 |  |

## Flou de déplacement  (`MotionBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Angle | Double | 25 | -180 | 180 | AngleChooser |
| Distance  | Double | 10 | 1 | 500 | échelle exp. |
| Centered | Boolean | 1 |  |  |  |

## Flou de surface  (`SurfaceBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Int32 | 6 | 1 | 50 |  |
| Seuil | Int32 | 15 | 1 | 100 |  |

## Flou de zoom  (`ZoomBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Distance | Double | None | None | None |  |
| Focus | Double | None | None | None |  |
| Centrage | DoubleVector |  |  |  |  |
| Qualité | Double | None | None | None |  |

## Flou médian  (`MedianBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Int32 | 10 | 0 | 100 |  |
| Centile | Int32 | 50 | 0 | 100 |  |
| Qualité | Int32 | 8 | 1 | None |  |

## Flou radial  (`RadialBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Angle | Double | None | None | None |  |
| Centrage | DoubleVector |  |  |  |  |
| Qualité | Double | None | None | None |  |

## Fractale de Julia  (`JuliaFractalGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Facteur | Double | 4 | 1 | 10 |  |
| Zoom | Double | 1 | 0.1 | 50 |  |
| Angle | Double | 0 | -180 | 180 | AngleChooser |
| Qualité | Int32 | None | None | None |  |
| MixMode | StaticListChoice | None | choix :  |  |  |

## Fractale de Mandelbrot  (`MandelbrotFractalGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| MandelbrotFractalEffect.ConfigDialog.Factor.Displa" + "yName | Double | 1 | 1 | 10 |  |
| MandelbrotFractalEffect.ConfigDialog.Zoom.DisplayN" + "ame | Double | 10 | 0 | 100 |  |
| MandelbrotFractalEffect.ConfigDialog.Angle.Display" + "Name | Double | 0 | -180 | 180 | AngleChooser |
| MandelbrotFractalEffect.ConfigDialog.Quality.Displ" + "ayName | Int32 | None | None | None |  |
| InvertColors | Boolean |  |  |  |  |
| MixMode | StaticListChoice | None | choix :  |  |  |

## FragmentBlurGpuEffect  (`FragmentBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Nombre de dédoublements | Int32 | 4 | 2 | 200 |  |
| Distance | Int32 | 8 | 0 | 400 |  |
| Rotation | Double | 0 | 0 | 360 | AngleChooser |

## GaussianBlurGpuEffect  (`GaussianBlurGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Double | 2 | 0 | <StandardDeviation.ToRadius> | échelle exp. |
| Augmentation du gamma | Double | 0 | -0.99 | 2 | échelle exp. |
| Qualité | Int32 | 4 | 1 | 4 |  |

## HueSaturationGpuEffect  (`HueSaturationGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Teinte | Int32 | 0 | 4294967116 | 180 |  |
| Saturation | Int32 | 100 | 0 | 200 |  |
| Intensité | Int32 | 0 | -100 | 100 |  |

## Mise en relief  (`ReliefGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Angle | Double | 45 | -180 | 180 | AngleChooser |

## Mises en lumière / Ombres  (`HighlightsAndShadowsGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Mises en lumière | Int32 | 0 | -100 | 100 |  |
| Ombres | Int32 | 0 | -100 | 100 |  |
| Clarté | Int32 | 0 | -100 | 100 |  |
| Rayon | Double | 1.25 | 0 | 10 |  |

## Morphologie  (`MorphologyGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Largeur | Int32 | 5 | 1 | 100 |  |
| La taille | Int32 | 5 | 1 | 100 |  |
| Linked | Boolean | 1 |  |  |  |

## Nuages  (`CloudsGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Échelle | Int32 | 250 | 2 | 1000 | échelle exp. |
| Rugosité | Double | 0.5 | 0 | 1 |  |
| MixMode | StaticListChoice | None | choix :  |  |  |
| Seed | Int32 | 0 | 0 | 255 | IncrementButton bouton « Randomiser » |

## Ombre portée  (`DropShadowGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon des ombres | Double | 10 | 0 | 100 | échelle exp. |
| Distance | Double | 10 | 0 | 100 |  |
| Angle | Double | -45 | -180 | 180 | AngleChooser |
| Opacité | Double | 0.75 | 0 | 1 |  |
| Couleur | Int32 | 0 | 0 | 16777215 | ColorWheel |
| ShadowOnly | Boolean | 0 |  |  |  |
| Note | String |  |  |  | Label |

## Peinture à l'huile  (`OilPaintingGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Largeur du pinceau | Int32 | 10 | 1 | 50 |  |
| OilPaintingEffect.ConfigDialog.Granularity.Display" + "Name | Double | 0.2 | 0.01 | 1 | échelle exp. |

## Pixéliser  (`PixelateGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Taille de la cellule | Int32 | 2 | 1 | 256 |  |
| Ancre | DoubleVector | ('obj', 'Vector2Double'), ('obj', 'Vector2Double'), ('obj', 'Vector2Double') |  |  |  |
| ScaleDownMode | StaticListChoice | MultisampleLinear | choix : Anisotropic, HighQualityCubic, MultisampleLinear, Cubic, Linear, NearestNeighbor |  |  |
| ScaleUpMode | StaticListChoice | NearestNeighbor | choix : Cubic, Linear, NearestNeighbor |  |  |

## PolarInversionGpuEffect  (`PolarInversionGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Échelle | Double | 1 | -8 | 8 | échelle exp. |
| Référence | DoubleVector |  |  |  |  |
| BorderEdgeMode | StaticListChoice | Mirror | choix : Clamp, Wrap, Mirror, Transparent |  |  |
| Qualité | Int32 | None | None | None |  |

## PosterizeGpuEffect  (`PosterizeGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| RedEnable | Boolean | 1 |  |  |  |
| RedLevels | Int32 | 16 | 2 | 64 |  |
| GreenEnable | Boolean | 1 |  |  |  |
| GreenLevels | Int32 | 16 | 2 | 64 |  |
| BlueEnable | Boolean | 1 |  |  |  |
| BlueLevels | Int32 | 16 | 2 | 64 |  |
| AlphaEnable | Boolean | 1 |  |  |  |
| AlphaLevels | Int32 | 16 | 2 | 64 |  |
| LinkLevels | Boolean | 1 |  |  |  |

## Redresser  (`StraightenGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Angle | Double | 0 | -45 | 45 | AngleChooser |
| Sampling | StaticListChoice | StraightenScaleMode#2 | choix : StraightenScaleMode#2, StraightenScaleMode#1, StraightenScaleMode#0 |  |  |

## Réduire le bruit  (`ReduceNoiseGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Int32 | 10 | 0 | 50 |  |
| Intensité | Double | 0.4 | 0 | 1 |  |

## Sépia  (`SepiaGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Intensité | Int32 | 50 | 0 | 100 |  |

## Température / Teinte  (`TemperatureAndTintGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Température | Int32 | 0 | -100 | 100 |  |
| Teinte | Int32 | 0 | -100 | 100 |  |

## TileReflectionGpuEffect  (`TileReflectionGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Angle | Double | 30 | -180 | 180 | AngleChooser |
| Taille de carreau | Double | 40 | 1 | 1600 | échelle exp. |
| Courbure | Double | 8 | -200 | 200 |  |
| EdgeMode | StaticListChoice | SampleMapEdgeMode#2 | choix : SampleMapEdgeMode#0, SampleMapEdgeMode#1, SampleMapEdgeMode#2, SampleMapEdgeMode#3 |  |  |
| Qualité | Int32 | None | None | None |  |

## Torsion  (`TwistGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Valeur / Sens | Int32 | 30 | 4294967096 | 200 | échelle exp. |
| Taille  | Double | 1 | 0.01 | 2 |  |
| Centrage | DoubleVector |  |  |  |  |
| Qualité | Int32 | None | None | None |  |

## Turbulence  (`TurbulenceGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Octaves | Int32 | 4 | 1 | 15 |  |
| Période | Double | 100 | 0.1 | 1024 | échelle exp. |
| Taille | Int32 | 4096 | 1 | 4096 |  |
| Seed | Int32 | 1 | 0 | 255 | IncrementButton bouton « Randomiser » |
| MixMode | StaticListChoice | None | choix :  |  |  |

## Verre dépoli  (`FrostedGlassGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| FrostedGlassEffect.ConfigDialog.MaxScatterRadius.D" + "isplayName | Double | 3 | 0 | 500 | échelle exp. |
| FrostedGlassEffect.ConfigDialog.MinScatterRadius.D" + "isplayName | Double | 0 | 0 | 500 | échelle exp. |
| FrostedGlassEffect.ConfigDialog.DiffusionExponent." + "DisplayName | Double | 1 | 0.01 | 3 |  |
| FrostedGlassEffect.ConfigDialog.NumSamples.Display" + "Name | Int32 | 2 | 1 | 8 |  |
| Seed | Int32 | 0 | 0 | 255 | IncrementButton bouton « Randomiser » |

## Vignette  (`VignetteGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Centré | DoubleVector | ('obj', 'Vector2Double'), ('obj', 'Vector2Double'), ('obj', 'Vector2Double') |  |  |  |
| Rayon | Double | 0.5 | 0.1 | 4 | échelle exp. |
| Intensité | Double | 1 | 0 | 1 | échelle exp. |

## Éclat  (`GlowGpuEffect`)

| Réglage | Type | Défaut | Min | Max | Contrôle |
|---|---|---|---|---|---|
| Rayon | Double | 6 | 1 | 20 |  |
| Luminosité | Int32 | 10 | -100 | 100 |  |
| Contraste | Int32 | 10 | -100 | 100 |  |
