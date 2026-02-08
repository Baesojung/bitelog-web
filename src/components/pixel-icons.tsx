import { forwardRef } from 'react';

// Wrapper for all pixel art icons to normalize size and props
export interface PixelIconProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
}

const PixelIcon = forwardRef<SVGSVGElement, PixelIconProps>(
    ({ size = 24, className, children, ...props }, ref) => {
        return (
            <svg
                ref={ref}
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="currentColor"
                className={className}
                style={{
                    display: 'inline-block',
                    verticalAlign: 'middle',
                }}
                {...props}
            >
                {children}
            </svg>
        );
    }
);
PixelIcon.displayName = 'PixelIcon';

// Icon: coffee (Used as "Meal")
export const PixelMeal = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M4 4h18v7h-4v5H4V4zm14 5h2V6h-2v3zm-2-3H6v8h10V6zm3 14H3v-2h16v2z" />
    </PixelIcon>
));
PixelMeal.displayName = 'PixelMeal';

// Icon: arrow-left
export const PixelArrowLeft = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M20 11v2H8v2H6v-2H4v-2h2V9h2v2h12zM10 7H8v2h2V7zm0 0h2V5h-2v2zm0 10H8v-2h2v2zm0 0h2v2h-2v-2z" />
    </PixelIcon>
));
PixelArrowLeft.displayName = 'PixelArrowLeft';

// Icon: android (Used as Bot)
export const PixelBot = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M2 5h2v2H2V5zm4 4H4V7h2v2zm2 0H6v2H4v2H2v6h20v-6h-2v-2h-2V9h2V7h2V5h-2v2h-2v2h-2V7H8v2zm0 0h8v2h2v2h2v4H4v-4h2v-2h2V9zm2 4H8v2h2v-2zm4 0h2v2h-2v-2z" />
    </PixelIcon>
));
PixelBot.displayName = 'PixelBot';

// Icon: user
export const PixelUser = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M15 2H9v2H7v6h2V4h6V2zm0 8H9v2h6v-2zm0-6h2v6h-2V4zM4 16h2v-2h12v2H6v4h12v-4h2v6H4v-6z" />
    </PixelIcon>
));
PixelUser.displayName = 'PixelUser';

// Icon: arrow-right (Used as Send)
export const PixelSend = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M4 11v2h12v2h2v-2h2v-2h-2V9h-2v2H4zm10-4h2v2h-2V7zm0 0h-2V5h2v2zm0 10h2v-2h-2v2zm0 0h-2v2h2v-2z" />
    </PixelIcon>
));
PixelSend.displayName = 'PixelSend';

// Icon: monitor
export const PixelMonitor = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M20 3H2v14h8v2H8v2h8v-2h-2v-2h8V3h-2zm-6 12H4V5h16v10h-6z" />
    </PixelIcon>
));
PixelMonitor.displayName = 'PixelMonitor';

// Icon: mood-happy (Used as Ghost/Pixel Mode Indicator)
export const PixelGhost = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M5 3h14v2H5V3zm0 16H3V5h2v14zm14 0v2H5v-2h14zm0 0h2V5h-2v14zM10 8H8v2h2V8zm4 0h2v2h-2V8zm-5 6v-2H7v2h2zm6 0v2H9v-2h6zm0 0h2v-2h-2v2z" />
    </PixelIcon>
));
PixelGhost.displayName = 'PixelGhost';

// Icon: plus
export const PixelPlus = forwardRef<SVGSVGElement, PixelIconProps>((props, ref) => (
    <PixelIcon ref={ref} {...props}>
        <path d="M13 11V4h-2v7H4v2h7v7h2v-7h7v-2h-7z" />
    </PixelIcon>
));
PixelPlus.displayName = 'PixelPlus';
