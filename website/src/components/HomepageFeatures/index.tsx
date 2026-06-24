import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  accent: string;
  icon: ReactNode;
  description: ReactNode;
};

const AdapterIcon = (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 24H6" />
    <path d="M42 24h-8" />
    <rect x="14" y="14" width="20" height="20" rx="5" />
    <path d="M20 14v-4M28 14v-4M20 38v-4M28 38v-4" />
  </svg>
);

const ParseIcon = (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8c-5 0-6 3-6 8s-2 8-6 8c4 0 6 3 6 8s1 8 6 8" />
    <path d="M30 8c5 0 6 3 6 8s2 8 6 8c-4 0-6 3-6 8s-1 8-6 8" />
  </svg>
);

const ModelsIcon = (
  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M24 6 6 15l18 9 18-9-18-9Z" />
    <path d="M6 24l18 9 18-9" />
    <path d="M6 33l18 9 18-9" />
  </svg>
);

const FeatureList: FeatureItem[] = [
  {
    title: 'Standalone Adapter',
    accent: 'nitrous',
    icon: AdapterIcon,
    description: (
      <>
        Run the GitHub Copilot CLI outside Paperclip. A thin Node ESM wrapper
        shells out to <code>copilot -p</code> with no framework lock-in.
      </>
    ),
  },
  {
    title: 'JSONL Event Parsing',
    accent: 'mint',
    icon: ParseIcon,
    description: (
      <>
        Streams JSONL events into structured results: session ID, assistant
        text, token usage, premium requests, and effective model hints.
      </>
    ),
  },
  {
    title: 'Model Catalog',
    accent: 'purple',
    icon: ModelsIcon,
    description: (
      <>
        A built-in catalog of supported models with capabilities and token
        limits. Select any model with a single <code>--model</code> flag.
      </>
    ),
  },
];

function Feature({title, accent, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.card}>
        <div className={clsx(styles.iconWrap, styles[accent])}>{icon}</div>
        <Heading as="h3" className={styles.cardTitle}>{title}</Heading>
        <p className={styles.cardText}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
