-- Disposable isolated rehearsal only; never apply to the native/demo/hosted DB.
CREATE ROLE sochat_release_app NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'synthetic-release-app-only';
ALTER DATABASE sochat_release OWNER TO sochat_release_app;
