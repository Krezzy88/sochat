\set ON_ERROR_STOP on
-- Run once as a local administrator. Existing names cause a safe stop.
CREATE ROLE sochat_dev LOGIN;
\password sochat_dev
CREATE DATABASE sochat_dev OWNER sochat_dev;
