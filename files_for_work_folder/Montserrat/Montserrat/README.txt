Montserrat 9.000
================

Original font files from the Montserrat project:
https://github.com/JulietaUla/Montserrat
Source revision: cc8daf2e7085006b9c112542fc82b58afc13521d

This package contains 18 static styles and two variable fonts, upright and
italic, in TTF and WOFF2 formats. The variable weight axis ranges from 100 to
900. There is no width axis. Ukrainian and Russian Cyrillic are supported.

All font binaries are unmodified originals from fonts/ttf, fonts/variable
and fonts/webfonts at the source revision above. Only file and directory
names have been adapted to the Webfonts catalogue structure.

Desktop installation
--------------------
Extract the archive first. Open the desired TTF files with the font installer
in Windows or Font Book in macOS. Install either the static styles you need
or the two variable TTF files. Avoid installing both sets simultaneously,
as their shared family name may cause conflicts. Variable fonts require
application support; use static styles if your editor displays them poorly.

Static web fonts
----------------
Open demo.html to see the static styles. stylesheet.css contains declarations
for all static styles, using WOFF2 first and TTF as a fallback. Copy only the
declarations required by your website, and adjust their paths to your setup.
The font-family name is "Montserrat". Regular is weight 400, SemiBold is 600
and Bold is 700. Use the actual italic file for italic text.

Variable web fonts
------------------
The example below assumes you copied the Montserrat directory to /fonts/.
It uses a separate CSS family name so you can keep static and variable
declarations distinct when experimenting.

@font-face {
  font-family: "Montserrat Variable";
  src: url("/fonts/Montserrat/MontserratVariable/MontserratVariable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Montserrat Variable";
  src: url("/fonts/Montserrat/MontserratVariableItalic/MontserratVariableItalic.woff2") format("woff2");
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}

body {
  font-family: "Montserrat Variable", sans-serif;
  font-weight: 400;
}

h1 {
  font-weight: 650;
}

em {
  font-style: italic;
}

License
-------
SIL Open Font License 1.1. See the original OFL.txt for all conditions.
Personal and commercial use are permitted. If redistributing the font
files, retain the copyright notices and license. Do not sell the font by
itself. Documents and designs made using it do not have to use the OFL.

Copyright notice embedded in the original font binaries:
Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat)

The original OFL.txt from the same source revision also carries:
Copyright 2024 The Montserrat.Git Project Authors (https://github.com/JulietaUla/Montserrat.git)
