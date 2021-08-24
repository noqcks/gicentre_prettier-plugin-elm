import { Parser, ParserOptions } from "prettier";

import { getCachedValue } from "./cache";
import { formatTextWithElmFormat, getElmFormatVersion } from "./util";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json");

/*
 * Simply passing text to elm-format is not enough because of two problems:
 *
 * 1. If the code chunk only contains an import statement, no formatting takes place.
 *    Related to: https://github.com/avh4/elm-format/issues/551
 * 2. `module Main exposing (.*)` is always added if no module has been defined,
 *    which is not wanted in markdown code blocks.
 *    Related to: https://github.com/avh4/elm-format/issues/65
 *
 * Until the upstream issues are fixed, two custom patches are applied:
 *
 * 1. A dummy comment is added to the source and is then removed from the result.
 * 2. If current context is a markdown block and the source does not declare a module,
 *    module statement is removed from the result.
 *
 * Please submit an issue to https://github.com/gicentre/prettier-plugin-elm/issues
 * if there are any problems caused by the patches.
 */

const dummyComment = "\n{- DUMMY COMMENT BY PRETTIER-PLUGIN-ELM -}";
const dummyCommentRemovalRegExp =
  /\n*\{- DUMMY COMMENT BY PRETTIER-PLUGIN-ELM -\}/;
const autogeneratedModuleDefinitionRegExp =
  /[ \t]*module\s+Main\s+exposing\s+\([^\n]+\)\n*/;

export const parse = (
  text: string,
  parsers: { [parserName: string]: Parser },
  opts: ParserOptions & { parentParser?: string },
) => {
  // patch 1 step 1
  const textToSend = `${text}${dummyComment}`;

  // extract formatted text from elm-format
  let formattedText = getCachedValue(
    formatTextWithElmFormat,
    [textToSend],
    [pkg.version, getElmFormatVersion()],
  );

  // patch 1 step 2
  formattedText = formattedText.replace(dummyCommentRemovalRegExp, "");
  if (formattedText === "\n") {
    formattedText = "";
  }

  // patch 2
  if (
    opts.parentParser === "markdown" &&
    autogeneratedModuleDefinitionRegExp.test(formattedText) &&
    !autogeneratedModuleDefinitionRegExp.test(text)
  ) {
    formattedText = formattedText.replace(
      autogeneratedModuleDefinitionRegExp,
      "",
    );
    formattedText = formattedText.replace(/\n+$/, "\n");
  }

  // return an AST with a single node that contain all the formatted elm code;
  // no further splitting into smaller tokens is made
  return {
    type: "elm-format",
    body: formattedText,
    end: text.length,
    source: text,
    start: 0,
  };
};
