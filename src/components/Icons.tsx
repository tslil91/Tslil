import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
});

export const IconPeople = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2 .7 3.5 2.6 3.5 5.7" /></svg>);
export const IconBillet = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>);
export const IconGift = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>);
export const IconClock = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>);
export const IconPlus = ({ size, ...p }: P) => (<svg {...base(size)} strokeWidth={2.6} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconSearch = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>);
export const IconChevron = ({ size, open, ...p }: P & { open?: boolean }) => (<svg {...base(size)} strokeWidth={2.6} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} {...p}><path d="M6 9l6 6 6-6" /></svg>);
export const IconMove = ({ size, ...p }: P) => (<svg {...base(size)} strokeWidth={2.2} {...p}><path d="M8 4v16M8 4L4 8M8 4l4 4M16 20V4M16 20l-4-4M16 20l4-4" /></svg>);
export const IconEdit = ({ size, ...p }: P) => (<svg {...base(size)} strokeWidth={2.2} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>);
export const IconCheck = ({ size, ...p }: P) => (<svg {...base(size)} strokeWidth={2.8} {...p}><path d="M5 12l5 5 9-10" /></svg>);
export const IconX = ({ size, ...p }: P) => (<svg {...base(size)} strokeWidth={2.6} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconTrash = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>);
export const IconTable = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></svg>);
export const IconTree = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" /><rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-5h14v5" /></svg>);
export const IconReset = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>);
