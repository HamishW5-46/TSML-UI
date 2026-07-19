import { useEffect } from 'react';

import { Global } from '@emotion/react';
import { Outlet } from 'react-router-dom';

import {
  DataProvider,
  ErrorProvider,
  FilterProvider,
  InputProvider,
  LocationProvider,
  SettingsProvider,
  useData,
  useInput,
  useLocation,
  useSettings,
} from '../hooks';
import { buttonCss, globalCss } from '../styles';

import { Alert, Controls, DynamicHeight, Loading, Map, Table, Title } from './';

export default function TsmlUI({
  google,
  settings: userSettings,
  src,
  timezone,
}: {
  google?: string;
  settings?: TSMLReactConfig;
  src?: string;
  timezone?: string;
}) {
  useEffect(() => {
    console.log(
      'TSML UI meeting finder: https://github.com/code4recovery/tsml-ui'
    );

    // add body class to help people style their pages
    document.body.classList.add('tsml-ui');
    return () => {
      document.body.classList.remove('tsml-ui');
    };
  }, []);

  return (
    <ErrorProvider>
      <SettingsProvider userSettings={userSettings}>
        <InputProvider>
          <LocationProvider>
            <DataProvider google={google} src={src} timezone={timezone}>
              <FilterProvider>
                <Global styles={globalCss} />
                <DynamicHeight>
                  <Outlet />
                </DynamicHeight>
              </FilterProvider>
            </DataProvider>
          </LocationProvider>
        </InputProvider>
      </SettingsProvider>
    </ErrorProvider>
  );
}

export const Index = () => {
  const { waitingForData } = useData();
  const { input } = useInput();
  const { settings } = useSettings();
  const { waitingForLocation } = useLocation();
  const customLinks = settings.custom_links?.filter(
    ({ label, url }) => label && url
  );

  return waitingForData ? (
    <Loading />
  ) : (
    <>
      <Title />
      <Controls />
      {!!customLinks?.length && (
        <nav
          aria-label="Meeting list downloads"
          className="tsml-ui-custom-links"
          css={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          {customLinks.map(({ label, url }) => (
            <a
              css={[
                buttonCss,
                {
                  flex: '1 1 18rem',
                  minWidth: 'min(100%, 18rem)',
                  width: 'auto',
                },
              ]}
              href={url}
              key={url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {label}
            </a>
          ))}
        </nav>
      )}
      {waitingForLocation ? (
        <Loading />
      ) : (
        <>
          <Alert />
          {input.view === 'map' ? <Map /> : <Table />}
        </>
      )}
    </>
  );
};
