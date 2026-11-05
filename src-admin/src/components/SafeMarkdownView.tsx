import React, { type JSX, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Untrusted documentation is Markdown, never executable HTML. */
export function safeDocumentationUrl(value: string | undefined, baseUrl: string, image = false): string | undefined {
    if (
        !value ||
        Array.from(value).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127) ||
        value.startsWith('\\') ||
        value.startsWith('//')
    ) {
        return undefined;
    }
    if (!image && value.startsWith('#')) {
        return value;
    }
    try {
        const url = new URL(value, baseUrl);
        if (url.protocol !== 'https:' && url.protocol !== 'http:' && !(!image && url.protocol === 'mailto:')) {
            return undefined;
        }
        if (url.username || url.password) {
            return undefined;
        }
        return url.href;
    } catch {
        return undefined;
    }
}

function visibleText(children: ReactNode): string {
    return React.Children.toArray(children)
        .map(child => {
            if (typeof child === 'string' || typeof child === 'number') {
                return String(child);
            }
            if (React.isValidElement<{ children?: ReactNode }>(child)) {
                return visibleText(child.props.children);
            }
            return '';
        })
        .join('');
}

interface SafeMarkdownViewProps {
    markdown: string;
    baseUrl: string;
    headingId: (text: string) => string;
    onAnchor: (id: string) => void;
    headingPrefix: string;
}

export default function SafeMarkdownView({
    markdown,
    baseUrl,
    headingId,
    onAnchor,
    headingPrefix,
}: SafeMarkdownViewProps): JSX.Element {
    // Relative document links use GitHub's HTML view; images retain the raw content URL.
    const documentBase = baseUrl
        .replace('https://raw.githubusercontent.com/', 'https://github.com/')
        .replace(/\/(master|main)\//, '/blob/$1/');
    const heading = (tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'): NonNullable<Components['h1']> =>
        function Heading({ children }) {
            const id = headingId(visibleText(children));
            return React.createElement(
                tag,
                { id },
                children,
                <a
                    className="md-h-link"
                    href={`${headingPrefix}?${encodeURIComponent(id)}`}
                    aria-label={`# ${visibleText(children)}`}
                    onClick={event => {
                        event.preventDefault();
                        onAnchor(id);
                    }}
                >
                    {' '}
                    🔗
                </a>,
            );
        };
    const components: Components = {
        a: ({ children, href, title }) => {
            const safe = safeDocumentationUrl(href, documentBase);
            if (!safe) {
                return <span>{children}</span>;
            }
            if (safe.startsWith('#')) {
                return (
                    <a
                        className="md-link"
                        href={safe}
                        title={title}
                        onClick={event => {
                            event.preventDefault();
                            onAnchor(headingId(safe.slice(1)));
                        }}
                    >
                        {children}
                    </a>
                );
            }
            return (
                <a
                    href={safe}
                    title={title}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {children}
                </a>
            );
        },
        img: ({ src, alt, title }) => {
            const safe = safeDocumentationUrl(typeof src === 'string' ? src : undefined, baseUrl, true);
            return safe ? (
                <img
                    src={safe}
                    alt={alt || ''}
                    title={title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                />
            ) : (
                <span>{alt}</span>
            );
        },
        h1: heading('h1'),
        h2: heading('h2'),
        h3: heading('h3'),
        h4: heading('h4'),
        h5: heading('h5'),
        h6: heading('h6'),
    };
    return (
        <ReactMarkdown
            skipHtml
            remarkPlugins={[remarkGfm]}
            components={components}
        >
            {markdown}
        </ReactMarkdown>
    );
}
