import React, {
  useEffect,
  useMemo,
  useRef,
  useContext,
  useCallback
} from "react";
import { useMedia } from "react-use";
import PropTypes from "prop-types";
import { shallowEqual, useSelector } from "react-redux";
import { getResponses } from "store/actions";
import { useAuthDispatch, isDefined, isNil } from "utility";
import { AppScrollContext } from "dynamic/AppRoot";

import DataGrid, { NumericFilter } from "components/DataGrid";
import { Container } from "react-bootstrap";
import {
  createResponseCellFormatter,
  createTriggerCellFormatter,
  createCountCellFormatter,
  AuthorCellFormatter
} from "./formatters";

import "./style.scss";

function AutoResponses({ guildId }) {
  // Connect to store
  const {
    commands,
    authors,
    authenticated,
    hasLoaded,
    isArchitusAdmin,
    user_id
  } = useSelector(state => {
    const id = guildId.toString();
    const hasLoaded = state.responses.commands.hasOwnProperty(id);
    const hasGuildListLoaded = state.guilds.hasLoaded;
    return {
      commands: hasLoaded ? state.responses.commands[id] : [],
      authors: hasLoaded ? state.responses.authors[id] : [],
      authenticated: state.session.authenticated,
      hasLoaded,
      isArchitusAdmin: hasGuildListLoaded
        ? state.guilds.guildList.find(guild => guild.id === id).autbot_admin
        : false,
      user_id: state.session.id
    };
  }, shallowEqual);

  // API fetch upon guildId/authentication updates
  const fetchResponses = useAuthDispatch(getResponses);
  useEffect(() => {
    if (authenticated) fetchResponses(guildId);
  }, [authenticated, guildId]);

  // Elevation status: use default function
  const canDeleteRow = isArchitusAdmin
    ? useCallback(() => true)
    : useCallback(({ author_id }) => author_id === user_id, [user_id]);

  // Row adding
  const onRowAdd = useCallback(row => {
    console.log(`Adding`);
    console.log(row);
  });

  // Row updating
  const onRowUpdate = useCallback(({ idx, key, updatedCell }) => {
    console.log(`Updating`);
    console.log({ idx, key, updatedCell });
  });

  // Row deletion
  const onRowDelete = useCallback(row => {
    console.log(`Deleting`);
    console.log(row);
  });

  // Transform author data
  const authorData = ({ author_id }) => {
    if (
      author_id <= 0 ||
      !authors.hasOwnProperty(author_id) ||
      isNil(authors[author_id])
    )
      return {
        author: "Unknown",
        avatar: null,
        name: "Unknown",
        discriminator: null
      };
    else {
      const { name, avatar, discriminator } = authors[author_id];
      return {
        author: `${name}#${discriminator}|${author_id}`,
        avatar,
        name,
        discriminator
      };
    }
  };
  const transformRow = row => {
    return isDefined(row) ? { ...row, ...authorData(row) } : row;
  };
  const transformedData = useMemo(() => commands.map(transformRow), [
    commands,
    authors
  ]);

  // Max count
  const maxCountRef = useRef(0);
  maxCountRef.current = useMemo(() => {
    if (commands.length === 0) return 0;
    else {
      let maxCount = 0;
      for (let i = 0; i < commands.length; ++i) {
        if (commands[i].count > maxCount) maxCount = commands[i].count;
      }
      return maxCount;
    }
  }, [commands]);

  // Mentions context
  const contextRef = useRef({ users: {} });
  contextRef.current = useMemo(() => {
    let map = {};
    for (var id in authors) {
      if (isDefined(authors[id])) {
        map[id] = { username: authors[id].name };
      }
    }
    return Object.freeze({ users: map });
  }, [authors]);

  // Column definitions
  const alphanumericRegex = useMemo(() => /[_\W]+/g);
  let columns = [
    {
      key: "trigger",
      name: "Trigger",
      editable: true,
      formatter: useMemo(() => createTriggerCellFormatter(contextRef), [
        contextRef
      ]),
      tooltip: (
        <span>
          Include <strong>*</strong> as a wildcard, and use a corresponding{" "}
          <strong>[capture]</strong> in the response to use the matched string.
        </span>
      ),
      hasAddField: true,
      required: true,
      info: (
        <span>
          Include <strong>*</strong> as a wildcard, and use a corresponding{" "}
          <strong>[capture]</strong> in the response to use the matched string.
        </span>
      ),
      validator: value => {
        if (value.trim().length < 2) {
          return {
            result: false,
            message: "Trigger must be 2 characters or longer"
          };
        } else {
          return true;
        }
      },
      processValue: value => value.replace(alphanumericRegex, "")
    },
    {
      key: "response",
      name: "Response",
      editable: true,
      formatter: useMemo(() => createResponseCellFormatter(contextRef), [
        contextRef
      ]),
      tooltip: (
        <span>
          <h6>Syntax</h6>
          [noun], [adj], [adv], [member], [owl], [:reaction:], [count],
          [capture], [author], [@author], [comma,separated,choices]
        </span>
      ),
      hasAddField: true,
      required: true,
      info: (
        <span>
          <strong>Allowed Syntax:</strong> [noun], [adj], [adv], [member],
          [owl], [:reaction:], [count], [capture], [author], [@author],
          [comma,separated,choices]
        </span>
      ),
      validator: value => {
        if (value.trim() === "list") {
          return {
            result: false,
            message: "Response cannot be a special command like list"
          };
        }

        if (value.trim() === "author") {
          return {
            result: false,
            message: "Response cannot be a special command like author"
          };
        }

        return true;
      }
    },
    {
      key: "count",
      name: "Count",
      sortDescendingFirst: true,
      formatter: useMemo(() => createCountCellFormatter(maxCountRef), [
        contextRef
      ]),
      filterRenderer: NumericFilter
    },
    {
      key: "author",
      name: "Author",
      formatter: AuthorCellFormatter
    }
  ];
  const baseColumnMeta = {
    sortable: true,
    filterable: true,
    resizable: true
  };
  let columnWidths = {
    base: [150, 300, 90, 200],
    "768": [200, null, 90, 200],
    "992": [270, null, 200, 240]
  };

  // Remove count column on mobile
  const isMobile = useMedia("(max-width: 767.9px)");
  if (isMobile) {
    const countColumnIndex = 2;
    const removeCountColumn = arr =>
      arr.filter((_c, i) => i !== countColumnIndex);
    columns = removeCountColumn(columns);
    for (var breakpoint in columnWidths) {
      if (columnWidths.hasOwnProperty(breakpoint)) {
        columnWidths[breakpoint] = removeCountColumn(columnWidths[breakpoint]);
      }
    }
  }

  const scrollEvent = useContext(AppScrollContext);
  const handleScroll = scrollEvent;

  return (
    <Container className="auto-responses" fluid>
      <div className="hide-mobile-landscape">
        <h2>Automatic Responses</h2>
        <p>
          Manage the triggers and automatic responses for all entries on the
          current server.
        </p>
      </div>
      <DataGrid
        data={transformedData}
        columns={columns}
        columnWidths={columnWidths}
        sortColumn="count"
        baseColumnMeta={baseColumnMeta}
        onRowAdd={onRowAdd}
        onRowUpdate={onRowUpdate}
        onRowDelete={onRowDelete}
        canDeleteRow={canDeleteRow}
        isLoading={!hasLoaded}
        emptyLabel="No responses to display"
        onScroll={handleScroll}
        dialogTitle="Add new auto response"
      />
    </Container>
  );
}

export default AutoResponses;

AutoResponses.propTypes = {
  guildId: PropTypes.string
};
