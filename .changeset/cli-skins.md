---
"@audio-ui/cli": minor
---

`add skin-hardware` and `add skin-neu` write the skin's plain sheet, `css/skin-<name>.css`, in every framework, React included, and import it last in `css/index.css`. A sheet added later still goes before the skins, so a skin always draws over the elements.
