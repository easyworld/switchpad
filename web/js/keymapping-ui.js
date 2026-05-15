window.KeyMappingUI = (() => {
  const BTN = window.SwitchButton;
  const _openListeners = [];

  let _currentEditing = null;
  let _tempMappings = {}; // event.code → switchButton value (same direction as KeyMappingService)

  // Button overlay definitions: { tag, label, x%, y%, w%, h%, className }
  // Positions derived from XAML Canvas coordinates (381×265 space)
  const BUTTONS = [
    // Shoulder buttons
    { tag: 'L',  label: 'L',  x: 12.5, y: 1.1, w: 14.4, h: 8.3, cls: 'pill' },
    { tag: 'ZL', label: 'ZL', x: 4.2,  y: 14.7, w: 11.5, h: 8.3, cls: 'pill' },
    { tag: 'R',  label: 'R',  x: 73.1, y: 1.1, w: 14.4, h: 8.3, cls: 'pill' },
    { tag: 'ZR', label: 'ZR', x: 84.2, y: 14.7, w: 11.5, h: 8.3, cls: 'pill' },
    // Left stick
    { tag: 'LStickUp',    label: '↑', x: 18.8, y: 13.6, w: 7.3, h: 10.6, cls: '' },
    { tag: 'LStickLeft',  label: '←', x: 10.8, y: 24.9, w: 7.3, h: 10.6, cls: '' },
    { tag: 'LStick',      label: 'L3', x: 17.5, y: 23.0, w: 10.0, h: 14.3, cls: '' },
    { tag: 'LStickRight', label: '→', x: 26.8, y: 24.9, w: 7.3, h: 10.6, cls: '' },
    { tag: 'LStickDown',  label: '↓', x: 18.8, y: 36.2, w: 7.3, h: 10.6, cls: '' },
    // D-pad
    { tag: 'DpadUp',    label: '↑', x: 30.7, y: 33.2, w: 7.9, h: 11.3, cls: '' },
    { tag: 'DpadLeft',  label: '←', x: 22.6, y: 44.5, w: 7.9, h: 11.3, cls: '' },
    { tag: 'DpadRight', label: '→', x: 38.8, y: 44.5, w: 7.9, h: 11.3, cls: '' },
    { tag: 'DpadDown',  label: '↓', x: 30.7, y: 55.8, w: 7.9, h: 11.3, cls: '' },
    // Center buttons
    { tag: 'Minus',   label: '-',   x: 33.5, y: 13.4, w: 8.4, h: 12.1, cls: '' },
    { tag: 'Plus',    label: '+',   x: 58.1, y: 13.4, w: 8.4, h: 12.1, cls: '' },
    { tag: 'Capture', label: '📷', x: 38.7, y: 24.2, w: 8.4, h: 12.1, cls: '' },
    { tag: 'Home',    label: '🏠', x: 52.4, y: 23.4, w: 9.4, h: 13.6, cls: '' },
    // ABXY
    { tag: 'X', label: 'X', x: 71.4, y: 13.4, w: 10.0, h: 14.3, cls: 'btn-x' },
    { tag: 'Y', label: 'Y', x: 63.6, y: 23.1, w: 10.0, h: 14.3, cls: 'btn-y' },
    { tag: 'A', label: 'A', x: 79.3, y: 23.1, w: 10.0, h: 14.3, cls: 'btn-a' },
    { tag: 'B', label: 'B', x: 71.4, y: 32.8, w: 10.0, h: 14.3, cls: 'btn-b' },
    // Right stick
    { tag: 'RStickUp',    label: '↑', x: 59.4, y: 33.2, w: 7.3, h: 10.6, cls: '' },
    { tag: 'RStickLeft',  label: '←', x: 51.4, y: 44.8, w: 7.3, h: 10.6, cls: '' },
    { tag: 'RStick',      label: 'R3', x: 58.1, y: 42.9, w: 10.0, h: 14.3, cls: '' },
    { tag: 'RStickRight', label: '→', x: 67.5, y: 44.8, w: 7.3, h: 10.6, cls: '' },
    { tag: 'RStickDown',  label: '↓', x: 59.4, y: 56.2, w: 7.3, h: 10.6, cls: '' },
  ];

  const _btnElements = {}; // tag → DOM element

  // ── SVG controller art ──
  function getControllerSVG() {
    return `
<!-- Top gray bar -->
<path fill="#898989" d="m40.117447 26.434603-.624252.05374.795353.367393 7.290438-.0527 3.671461.0527.483862-.202028.422741-.192731-2.134264-.113194-7.730794-.0083z" transform="matrix(10,0,0,10,-267.15988,-259.30946)"/>

<!-- Main body -->
<path fill="#898989" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c.97 0 1.947.018 2.915-.069c.882-.079 1.775-.298 2.525-.787c.831-.543 1.467-1.321 2.024-2.13c.603-.875 1.107-1.814 1.588-2.76c1.022-2.008 1.947-4.064 2.984-6.066c.834-1.613 1.686-3.225 2.631-4.777c.919-1.506 1.938-2.97 3.392-4.003c1.503-1.066 3.336-1.637 5.18-1.512c1.955.131 3.826 1.004 5.325 2.242c2.776 2.292 4.007 5.817 4.231 9.323c.141 2.206-.03 4.435-.263 6.631c-.185 1.74-.404 3.484-.689 5.211c-.21 1.277-.421 2.554-.631 3.83c-.368 2.226-.735 4.451-1.104 6.678c-.277 1.679-.554 3.359-.832 5.04c-.367 2.229-.78 4.453-1.212 6.672c-.321 1.641-.665 3.275-.959 4.921c-.375 2.109-.842 4.21-1.362 6.288c-.266 1.071-.559 2.136-.885 3.19c-.165.529-.337 1.055-.521 1.577c-.096.272-.194.544-.296.816c-.097.255-.175.507-.341.726c-.344.456-.687.912-1.032 1.369c-.179.238-.359.475-.536.712c-.133.176-.296.428-.506.521c-.824.362-1.619.781-2.395 1.24c-.957.565-1.897 1.16-2.882 1.677c-.977.511-1.987.958-3.023 1.335c-2.116.77-4.323 1.245-6.551 1.555c-2.295.32-4.612.492-6.923.633c-2.316.141-4.636.232-6.955.294c-4.627.125-9.257.134-13.886.134c-4.63 0-9.26-.009-13.887-.134c-2.32-.062-4.639-.153-6.955-.294c-2.313-.141-4.629-.313-6.924-.633c-2.226-.31-4.435-.785-6.551-1.555c-1.035-.377-2.046-.824-3.022-1.335c-.985-.517-1.925-1.112-2.883-1.677c-.774-.459-1.57-.878-2.394-1.24c-.21-.093-.374-.345-.505-.521c-.18-.237-.358-.474-.537-.712c-.344-.457-.689-.913-1.034-1.369c-.165-.219-.244-.471-.339-.726c-.102-.272-.2-.544-.296-.816c-.183-.522-.357-1.048-.521-1.577c-.328-1.054-.619-2.119-.887-3.19c-.517-2.078-.985-4.179-1.361-6.288c-.294-1.646-.638-3.28-.958-4.921c-.433-2.219-.845-4.443-1.214-6.672c-.277-1.681-.554-3.361-.832-5.04c-.367-2.227-.734-4.452-1.101-6.678c-.211-1.276-.422-2.553-.633-3.83c-.285-1.727-.504-3.471-.688-5.211c-.233-2.196-.404-4.425-.263-6.631c.222-3.506 1.455-7.031 4.23-9.323c1.499-1.238 3.37-2.111 5.324-2.242c1.846-.125 3.678.446 5.18 1.512c1.456 1.033 2.475 2.497 3.393 4.003c.947 1.552 1.796 3.164 2.632 4.777c1.036 2.002 1.961 4.058 2.984 6.066c.481.946.985 1.885 1.587 2.76c.558.809 1.193 1.587 2.025 2.13c.75.489 1.643.708 2.525.787c.967.087 1.944.069 2.915.069Z" transform="matrix(3.5277777,0,0,-3.5277777,264.58,186.79)"/>

<!-- Top connecting line -->
<path fill="#898989" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c-4.652.222-9.961.398-14.617.413c-1.744.006-5.234.005-6.978 0c-4.656-.013-9.964-.191-14.616-.413" transform="matrix(3.5277777,0,0,-3.5277777,254.41,5.30)"/>

<!-- Left stick base -->
<path fill="#DCDDDD" d="M0 0c-3.757 0-6.804 3.046-6.804 6.804 0 3.756 3.047 6.803 6.804 6.803s6.803-3.047 6.803-6.803c0-3.758-3.046-6.804-6.803-6.804" transform="matrix(3.5277777,0,0,-3.5277777,240.54,156.73)"/>

<!-- Right stick base -->
<path fill="#DCDDDD" d="M0 0c-3.758 0-6.804 3.047-6.804 6.804 0 3.758 3.046 6.803 6.804 6.803 3.757 0 6.803-3.045 6.803-6.803 0-3.757-3.046-6.804-6.803-6.804" transform="matrix(3.5277777,0,0,-3.5277777,85.54,104.23)"/>

<!-- D-pad fill -->
<path fill="#666565" d="M0 0c0 .06.025.146.059.195c.076.115.159.16.297.159c1.382 0 2.767-.002 4.151-.004c.47-.002.85.379.85.848v1.73 1.728c0 .471-.38.851-.85.85c-1.384-.002-2.769-.004-4.151-.006c-.197 0-.356.158-.356.354c.002 1.384.004 2.768.006 4.152c.002.47-.379.851-.849.851c-1.153-.001-2.305-.001-3.458 0c-.47 0-.85-.381-.849-.851c.002-1.384.004-2.768.006-4.152c0-.145-.049-.231-.174-.305c-.047-.028-.126-.049-.181-.049c-1.384.002-2.768.004-4.151.006c-.471.001-.852-.379-.852-.85v-1.728-1.73c0-.469.381-.85.852-.848c1.383.002 2.767.004 4.151.004c.138.001.22-.044.296-.159c.033-.049.059-.135.059-.195c-.002-1.383-.004-2.768-.006-4.151c-.001-.47.379-.851.849-.851h3.458c.47 0 .851.381.849.851c-.002 1.383-.004 2.768-.006 4.151" transform="matrix(3.5277777,0,0,-3.5277777,140.86,143.05)"/>

<!-- ABXY fills -->
<path fill="#666565" d="M0 0c0-2.201-1.785-3.986-3.986-3.986s-3.987 1.785-3.987 3.986c0 2.202 1.786 3.986 3.987 3.986s3.986-1.784 3.986-3.986" transform="matrix(3.5277777,0,0,-3.5277777,275.47,80.23)"/>
<path fill="#666565" d="M0 0c0-2.201 1.785-3.986 3.986-3.986s3.987 1.785 3.987 3.986-1.786 3.986-3.987 3.986-3.986-1.785-3.986-3.986" transform="matrix(3.5277777,0,0,-3.5277777,277.10,105.98)"/>
<path fill="#666565" d="M0 0c0 2.202 1.784 3.986 3.985 3.986 2.202 0 3.987-1.784 3.987-3.986 0-2.201-1.785-3.986-3.987-3.986-2.201 0-3.985 1.785-3.985 3.986" transform="matrix(3.5277777,0,0,-3.5277777,306.85,80.23)"/>
<path fill="#666565" d="M0 0c0-2.202-1.785-3.986-3.986-3.986s-3.987 1.784-3.987 3.986 1.786 3.986 3.987 3.986 3.986-1.784 3.986-3.986" transform="matrix(3.5277777,0,0,-3.5277777,305.23,54.48)"/>

<!-- Capture square -->
<path fill="#666565" d="M0 0v2.87c0 .392.317.709.709.709h2.87c.391 0 .709-.317.709-.709v-2.87c0-.392-.318-.708-.709-.708h-2.87c-.392 0-.709.316-.709.708" transform="matrix(3.5277777,0,0,-3.5277777,155.97,85.29)"/>

<!-- HOME / Plus / Minus circles -->
<path fill="#666565" d="M0 0c0 1.331 1.078 2.408 2.409 2.408s2.41-1.077 2.41-2.408-1.079-2.41-2.41-2.41-2.409 1.079-2.409 2.41" transform="matrix(3.5277777,0,0,-3.5277777,229.04,51.48)"/>
<path fill="#666565" d="M0 0c0 1.331 1.079 2.408 2.409 2.408s2.409-1.077 2.409-2.408-1.079-2.41-2.409-2.41-2.409 1.079-2.409 2.41" transform="matrix(3.5277777,0,0,-3.5277777,135.04,51.48)"/>
<path fill="#666565" d="M0 0c0-1.33-1.078-2.409-2.41-2.409-1.33 0-2.408 1.079-2.408 2.409 0 1.331 1.078 2.411 2.408 2.411 1.332 0 2.41-1.08 2.41-2.411" transform="matrix(3.5277777,0,0,-3.5277777,226.04,80.23)"/>

<!-- Stick outer rings -->
<path fill="#666565" d="M0 0c3.287 0 5.952 2.665 5.952 5.952 0 3.288-2.665 5.954-5.952 5.954s-5.952-2.666-5.952-5.954c0-3.287 2.665-5.952 5.952-5.952" transform="matrix(3.5277777,0,0,-3.5277777,240.54,153.73)"/>
<path fill="#666565" d="M0 0c3.287 0 5.951 2.666 5.951 5.954s-2.664 5.953-5.951 5.953c-3.288 0-5.953-2.665-5.953-5.953s2.665-5.954 5.953-5.954" transform="matrix(3.5277777,0,0,-3.5277777,85.54,101.23)"/>

<!-- Grip decorations -->
<path fill="#666565" d="M0 0c.716.329 1.411.7 2.09 1.103c.958.565 1.897 1.16 2.883 1.676c.976.512 1.987.958 3.022 1.335c2.115.771 4.324 1.245 6.551 1.556c2.295.319 4.611.492 6.924.633c1.766.107 3.535.185 5.304.244c-.957.419-3.07 1.339-4.031 1.751l-.002.001c-.057.025-.115.05-.173.075l-.003.001c-.824.354-1.619.628-2.546.618c-.414-.005-1.138-.042-1.551-.073c-1.725-.132-3.439-.32-5.149-.583c-.421-.064-.841-.135-1.261-.21c-1.323-.236-2.618-.522-3.889-.978c-.623-.222-1.662-.696-2.238-1.023c-1.277-.724-2.432-1.567-3.516-2.556c-.26-.236-.474-.499-.658-.797l.002-.001l-.002.001c-.484-.772-1.277-2.012-1.77-2.78z" transform="matrix(3.5277777,0,0,-3.5277777,41.27,32.34)"/>
<path fill="#666565" d="M0 0c-.716.329-1.411.7-2.09 1.103c-.958.565-1.897 1.16-2.883 1.676c-.976.512-1.987.958-3.022 1.335c-2.115.771-4.324 1.245-6.551 1.556c-2.295.319-4.611.492-6.924.633c-1.766.107-3.535.185-5.304.244c.957.419 3.07 1.339 4.031 1.751l.002.001c.057.025.115.05.173.075l.003.001c.824.354 1.619.628 2.546.618c.415-.005 1.138-.042 1.551-.073c1.725-.132 3.439-.32 5.149-.583c.421-.064.842-.135 1.262-.21c1.323-.236 2.618-.522 3.889-.978c.623-.222 1.662-.696 2.238-1.023c1.277-.724 2.432-1.567 3.516-2.556c.26-.236.474-.499.658-.797l-.001.001c.484-.772 1.278-2.012 1.77-2.78z" transform="matrix(3.5277777,0,0,-3.5277777,339.80,32.34)"/>

<!-- D-pad arrows -->
<path fill="White" d="M0 0c-.048-.084-.128-.084-.175 0l-.601 1.041c-.048.082-.008.15.088.15h1.201c.096 0 .135-.068.086-.15z" transform="matrix(3.5277777,0,0,-3.5277777,132.09,153.55)"/>
<path fill="White" d="M0 0c.048.083.128.083.176 0l.598-1.039c.05-.085.01-.151-.086-.151h-1.201c-.095 0-.135.066-.088.151z" transform="matrix(3.5277777,0,0,-3.5277777,131.47,112.33)"/>
<path fill="White" d="M0 0c.082-.047.082-.126 0-.176l-1.041-.599c-.084-.048-.151-.01-.151.086v1.202c0 .096.067.135.151.089z" transform="matrix(3.5277777,0,0,-3.5277777,152.61,132.41)"/>
<path fill="White" d="M0 0c-.084.048-.084.128 0 .174l1.04.601c.083.049.152.009.152-.087v-1.202c0-.095-.069-.135-.152-.087z" transform="matrix(3.5277777,0,0,-3.5277777,111.38,133.03)"/>

<!-- ABXY letter labels -->
<path fill="White" d="M0 0h-.439v.984h-.985v.44h.985v.984h.439v-.984h.984v-.44h-.984zM-.252 1.086h.508c.242 0 .525.104.525.434 0 .315-.269.434-.596.434h-.437zM-.252 0h.469c.365 0 .683.137.683.482 0 .327-.234.489-.637.489h-.515z" transform="matrix(3.5277777,0,0,-3.5277777,289.38,109.57)"/>
<path fill="White" d="M0 0h1.092l-.546 1.317zM-.365-.883h-.277l1.073 2.481h.245l1.064-2.481h-.279l-.273.653h-1.284z" transform="matrix(3.5277777,0,0,-3.5277777,318.98,80.97)"/>
<path fill="White" d="M0 0l.677 1.002h.302l-.825-1.181.911-1.3h-.315l-.756 1.118-.754-1.118h-.315l.911 1.303-.83 1.178h.314z" transform="matrix(3.5277777,0,0,-3.5277777,291.18,53.62)"/>
<path fill="White" d="M0 0h-.253v1.068l-.928 1.412h.316l.746-1.202.753 1.202h.295l-.929-1.412z" transform="matrix(3.5277777,0,0,-3.5277777,261.86,84.58)"/>

<!-- Plus icon -->
<path fill="#231916" d="M0 0h-.439v.984h-.985v.44h.985v.984h.439v-.984h.984v-.44h-.984z" transform="matrix(3.5277777,0,0,-3.5277777,238.28,55.72)"/>

<!-- Minus line -->
<path fill="#231916" d="m41.493919 31.162628h-.849489v-.15487h.849489z" transform="matrix(10,0,0,10,-267.15988,-259.30946)"/>

<!-- HOME icon -->
<path fill="#231916" d="M0 0c0-.062-.025-.087-.087-.087h-.695c-.061 0-.086.025-.086.087v.521c0 .062.025.087.086.087h.695c.059 0 .084-.024.087-.083zM.92.848c-.433.368-.865.736-1.298 1.103c-.041.035-.072.035-.113 0c-.432-.367-.865-.735-1.297-1.103c-.078-.067-.047-.153.056-.153h.167c.062 0 .087-.025.087-.088v-1.128c0-.063.026-.088.087-.088h1.913c.061 0 .086.025.086.088v1.128c0 .063.026.088.088.088h.167c.103 0 .135.086.057.153" transform="matrix(3.5277777,0,0,-3.5277777,219.05,82.01)"/>

<!-- Stroke outlines (fill=none) -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0 .06.025.146.059.195c.076.115.159.16.297.159c1.382 0 2.767-.002 4.151-.004c.47-.002.85.379.85.848v1.73 1.728c0 .471-.38.851-.85.85c-1.384-.002-2.769-.004-4.151-.006c-.197 0-.356.158-.356.354c.002 1.384.004 2.768.006 4.152c.002.47-.379.851-.849.851c-1.153-.001-2.305-.001-3.458 0c-.47 0-.85-.381-.849-.851c.002-1.384.004-2.768.006-4.152c0-.145-.049-.231-.174-.305c-.047-.028-.126-.049-.181-.049c-1.384.002-2.768.004-4.151.006c-.471.001-.852-.379-.852-.85v-1.728-1.73c0-.469.381-.85.852-.848c1.383.002 2.767.004 4.151.004c.138.001.22-.044.296-.159c.033-.049.059-.135.059-.195c-.002-1.383-.004-2.768-.006-4.151c-.001-.47.379-.851.849-.851h3.458c.47 0 .851.381.849.851c-.002 1.383-.004 2.768-.006 4.151Z" transform="matrix(3.5277777,0,0,-3.5277777,140.86,143.05)"/>

<!-- Center ring outline -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0-1.839 1.492-3.329 3.33-3.329 1.84 0 3.332 1.49 3.332 3.329 0 1.84-1.492 3.331-3.332 3.331-1.838 0-3.33-1.491-3.33-3.331Z" transform="matrix(3.5277777,0,0,-3.5277777,205.79,80.23)"/>

<!-- ABXY circle outlines -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0-2.201-1.785-3.986-3.986-3.986s-3.987 1.785-3.987 3.986c0 2.202 1.786 3.986 3.987 3.986s3.986-1.784 3.986-3.986Z" transform="matrix(3.5277777,0,0,-3.5277777,275.47,80.23)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0-2.201 1.785-3.986 3.986-3.986s3.987 1.785 3.987 3.986-1.786 3.986-3.987 3.986-3.986-1.785-3.986-3.986Z" transform="matrix(3.5277777,0,0,-3.5277777,277.10,105.98)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0 2.202 1.784 3.986 3.985 3.986 2.202 0 3.987-1.784 3.987-3.986 0-2.201-1.785-3.986-3.987-3.986-2.201 0-3.985 1.785-3.985 3.986Z" transform="matrix(3.5277777,0,0,-3.5277777,306.85,80.23)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0-2.202-1.785-3.986-3.986-3.986s-3.987 1.784-3.987 3.986 1.786 3.986 3.987 3.986 3.986-1.784 3.986-3.986Z" transform="matrix(3.5277777,0,0,-3.5277777,305.23,54.48)"/>

<!-- Capture outline -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0v2.87c0 .392.317.709.709.709h2.87c.391 0 .709-.317.709-.709v-2.87c0-.392-.318-.708-.709-.708h-2.87c-.392 0-.709.316-.709.708Z" transform="matrix(3.5277777,0,0,-3.5277777,155.97,85.29)"/>

<!-- Stick outlines -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c-3.757 0-6.804 3.046-6.804 6.804 0 3.756 3.047 6.803 6.804 6.803s6.803-3.047 6.803-6.803c0-3.758-3.046-6.804-6.803-6.804Z" transform="matrix(3.5277777,0,0,-3.5277777,240.54,156.73)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c3.287 0 5.952 2.665 5.952 5.952 0 3.288-2.665 5.954-5.952 5.954s-5.952-2.666-5.952-5.954c0-3.287 2.665-5.952 5.952-5.952Z" transform="matrix(3.5277777,0,0,-3.5277777,240.54,153.73)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c-2.491 0-4.511 2.019-4.511 4.51 0 2.492 2.02 4.511 4.511 4.511s4.51-2.019 4.51-4.51c0-2.492-2.019-4.511-4.51-4.511Z" transform="matrix(3.5277777,0,0,-3.5277777,240.54,148.64)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c-3.758 0-6.804 3.047-6.804 6.804 0 3.758 3.046 6.803 6.804 6.803 3.757 0 6.803-3.045 6.803-6.803 0-3.757-3.046-6.804-6.803-6.804Z" transform="matrix(3.5277777,0,0,-3.5277777,85.54,104.23)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c3.287 0 5.951 2.666 5.951 5.954s-2.664 5.953-5.951 5.953c-3.288 0-5.953-2.665-5.953-5.953s2.665-5.954 5.953-5.954Z" transform="matrix(3.5277777,0,0,-3.5277777,85.54,101.23)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c-2.492 0-4.511 2.018-4.511 4.51 0 2.49 2.019 4.509 4.511 4.509 2.49 0 4.51-2.019 4.51-4.509 0-2.492-2.02-4.51-4.51-4.51Z" transform="matrix(3.5277777,0,0,-3.5277777,85.54,96.14)"/>

<!-- HOME/Plus/Minus circle outlines -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0 1.331 1.078 2.408 2.409 2.408s2.41-1.077 2.41-2.408-1.079-2.41-2.41-2.41-2.409 1.079-2.409 2.41Z" transform="matrix(3.5277777,0,0,-3.5277777,229.04,51.48)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0 1.331 1.079 2.408 2.409 2.408s2.409-1.077 2.409-2.408-1.079-2.41-2.409-2.41-2.409 1.079-2.409 2.41Z" transform="matrix(3.5277777,0,0,-3.5277777,135.04,51.48)"/>
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0-1.33-1.078-2.409-2.41-2.409-1.33 0-2.408 1.079-2.408 2.409 0 1.331 1.078 2.411 2.408 2.411 1.332 0 2.41-1.08 2.41-2.411Z" transform="matrix(3.5277777,0,0,-3.5277777,226.04,80.23)"/>

<!-- D-pad outer circle -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0 4.695-3.808 8.504-8.504 8.504-4.697 0-8.504-3.809-8.504-8.504 0-4.697 3.807-8.505 8.504-8.505 4.696 0 8.504 3.808 8.504 8.505Z" transform="matrix(3.5277777,0,0,-3.5277777,115.54,80.22)"/>

<!-- Right stick outer circle -->
<path fill="none" stroke="#231916" stroke-width="0.35" stroke-linejoin="round" stroke-linecap="round" d="M0 0c0-4.696 3.808-8.504 8.505-8.504 4.695 0 8.504 3.808 8.504 8.504 0 4.697-3.809 8.504-8.504 8.504-4.697 0-8.505-3.807-8.505-8.504Z" transform="matrix(3.5277777,0,0,-3.5277777,210.53,132.73)"/>
`;
  }

  function buildSVG() {
    const svg = document.getElementById('controller-svg');
    svg.innerHTML = getControllerSVG();
  }

  function buildOverlays() {
    const container = document.getElementById('button-overlays');
    container.innerHTML = '';

    for (const def of BUTTONS) {
      const el = document.createElement('button');
      el.className = 'overlay-btn' + (def.cls ? ' ' + def.cls : '');
      el.style.left = def.x + '%';
      el.style.top = def.y + '%';
      el.style.width = def.w + '%';
      el.style.height = def.h + '%';
      el.dataset.button = def.tag;
      el.textContent = def.label;
      el.addEventListener('click', () => onOverlayClick(def.tag));
      container.appendChild(el);
      _btnElements[def.tag] = el;
    }
  }

  function loadCurrentMappings() {
    _tempMappings = { ...window.KeyMappingService.getAllMappings() };
  }

  function findCodeForButton(btnVal) {
    return Object.entries(_tempMappings).find(([, v]) => v === btnVal)?.[0] || null;
  }

  function updateButtonDisplay(tag) {
    const el = _btnElements[tag];
    if (!el) return;

    const btnVal = BTN[tag];
    const code = findCodeForButton(btnVal);

    // Remove mapped class
    el.classList.remove('mapped');

    if (code) {
      el.classList.add('mapped');
      el.innerHTML = `<span class="btn-label">${el.dataset.origLabel || getDef(tag)?.label || tag}</span><span class="key-label">${keyShortName(code)}</span>`;
    } else {
      const def = getDef(tag);
      el.textContent = def ? def.label : tag;
    }
  }

  function updateAllDisplays() {
    for (const def of BUTTONS) {
      const el = _btnElements[def.tag];
      if (el) el.dataset.origLabel = def.label;
      updateButtonDisplay(def.tag);
    }
  }

  function getDef(tag) {
    return BUTTONS.find(b => b.tag === tag);
  }

  function onOverlayClick(tag) {
    _currentEditing = tag;
    resetHighlights();
    const el = _btnElements[tag];
    if (el) el.classList.add('highlight');

    const code = findCodeForButton(BTN[tag]);
    const info = document.getElementById('km-info');
    const detail = document.getElementById('km-detail');
    info.textContent = `正在配置: ${tag}`;
    detail.textContent = `当前: ${code ? keyShortName(code) : '未配置'}  |  请按下键盘按键...`;
    detail.style.color = '#64b4ff';
  }

  function onKeyDown(e) {
    if (_currentEditing === null) return;

    // Skip modifier-only keys
    if (['ControlLeft','ControlRight','AltLeft','AltRight','ShiftLeft','ShiftRight','MetaLeft','MetaRight'].includes(e.code)) return;

    // If this key was already mapped to another button, remove that old mapping
    if (_tempMappings[e.code] !== undefined && _tempMappings[e.code] !== BTN[_currentEditing]) {
      const oldBtnTag = Object.entries(BTN).find(([, v]) => v === _tempMappings[e.code])?.[0];
      delete _tempMappings[e.code];
      if (oldBtnTag) updateButtonDisplay(oldBtnTag);
    }

    // If current button was already mapped to another key, remove that old mapping
    const btnVal = BTN[_currentEditing];
    const oldCode = Object.entries(_tempMappings).find(([, v]) => v === btnVal)?.[0];
    if (oldCode && oldCode !== e.code) {
      delete _tempMappings[oldCode];
    }

    _tempMappings[e.code] = btnVal;

    const info = document.getElementById('km-info');
    const detail = document.getElementById('km-detail');
    info.textContent = `✓ ${_currentEditing} → ${keyShortName(e.code)}`;
    detail.textContent = '点击其他按键继续配置，或点击保存';
    detail.style.color = '#50c878';

    updateButtonDisplay(_currentEditing);
    resetHighlights();
    _currentEditing = null;
    e.preventDefault();
  }

  function resetHighlights() {
    for (const def of BUTTONS) {
      _btnElements[def.tag]?.classList.remove('highlight');
    }
  }

  function keyShortName(code) {
    const map = {
      'Space': 'Spc', 'Enter': 'Ent', 'Escape': 'Esc', 'Backspace': 'BS',
      'Tab': 'Tab', 'Delete': 'Del', 'Insert': 'Ins', 'Home': 'Hm',
      'End': 'End', 'PageUp': 'PgU', 'PageDown': 'PgD',
      'ArrowLeft': '◄', 'ArrowRight': '►', 'ArrowUp': '▲', 'ArrowDown': '▼',
      'ShiftLeft': 'Shft', 'ShiftRight': 'Shft',
      'ControlLeft': 'Ctrl', 'ControlRight': 'Ctrl',
      'AltLeft': 'Alt', 'AltRight': 'Alt',
      'Minus': '-', 'Equal': '=',
    };
    if (map[code]) return map[code];
    // Remove 'Key' prefix
    const display = code.replace(/^Key/, '');
    return display.length <= 4 ? display : display.slice(0, 4);
  }

  function resetToDefaults() {
    _tempMappings = {
      'KeyW': BTN.DpadUp, 'KeyS': BTN.DpadDown, 'KeyA': BTN.DpadLeft, 'KeyD': BTN.DpadRight,
      'KeyJ': BTN.A, 'KeyK': BTN.B, 'KeyU': BTN.X, 'KeyI': BTN.Y,
      'KeyQ': BTN.L, 'KeyE': BTN.R, 'KeyZ': BTN.ZL, 'KeyC': BTN.ZR,
      'Minus': BTN.Minus, 'Equal': BTN.Plus,
      'KeyH': BTN.Home, 'KeyP': BTN.Capture,
      'KeyF': BTN.LStick, 'KeyG': BTN.RStick,
      'ArrowUp': BTN.LStickUp, 'ArrowDown': BTN.LStickDown,
      'ArrowLeft': BTN.LStickLeft, 'ArrowRight': BTN.LStickRight,
    };
    updateAllDisplays();

    const info = document.getElementById('km-info');
    const detail = document.getElementById('km-detail');
    info.textContent = '已重置为默认配置';
    detail.textContent = '点击保存按钮应用更改';
    detail.style.color = '#aaa';
  }

  function save() {
    window.KeyMappingService.saveAllMappings(_tempMappings); // { code: btnVal } — same format
    window.KeyMappingService.loadMappings();
  }

  function openDialog() {
    loadCurrentMappings();
    buildSVG();
    buildOverlays();
    updateAllDisplays();
    resetHighlights();
    _currentEditing = null;

    document.getElementById('km-info').textContent = '点击任意按键开始配置';
    document.getElementById('km-detail').textContent = '';
    document.getElementById('keymapping-overlay').classList.remove('hidden');

    document.addEventListener('keydown', onKeyDown);
    _openListeners.forEach(fn => fn(true));
  }

  function closeDialog() {
    document.getElementById('keymapping-overlay').classList.add('hidden');
    document.removeEventListener('keydown', onKeyDown);
    _currentEditing = null;
    _openListeners.forEach(fn => fn(false));
  }

  function init() {
    document.getElementById('btn-km-save').addEventListener('click', () => { save(); closeDialog(); });
    document.getElementById('btn-km-reset').addEventListener('click', resetToDefaults);
    document.getElementById('btn-km-cancel').addEventListener('click', closeDialog);
  }

  function onOpenChange(fn) { _openListeners.push(fn); }

  return { init, openDialog, closeDialog, onOpenChange };
})();

document.addEventListener('DOMContentLoaded', () => window.KeyMappingUI.init());
