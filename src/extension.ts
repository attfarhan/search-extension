// tslint:disable-next-line:rxjs-no-wholesale
import { EMPTY, from, of } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import * as sourcegraph from 'sourcegraph';

export function activate(): void {
    sourcegraph.search.registerQueryTransformer({
        transformQuery: (query: string) => {
            const goImportsRegex = /\bgo.imports:([\w\/]*)/;
            if (query.match(goImportsRegex)) {
                // Get package name
                const pkgFilter = query.match(goImportsRegex);
                const pkg =
                    pkgFilter && pkgFilter.length >= 1 ? pkgFilter[1] : '';

                // Package imported in grouped import statements
                const matchPackage = '\\t"' + pkg + '"$';
                // Match packages with aliases
                const matchAlias = '\\t[\\w/]*\\s"' + pkg + '"$';
                // Match packages in single import statement
                const matchSingle = 'import\\s"' + pkg + '"$';
                const finalRegex = `(${matchPackage}|${matchAlias}|${matchSingle})`;

                return query.replace(goImportsRegex, finalRegex);
            }
            return query;
        }
    });

    sourcegraph.workspace.onDidOpenTextDocument.subscribe(doc => {
        from(doc.text.split('\n')).pipe(
            concatMap(
                (line, lineNumber) => {
                    // An issue with the second regex is that it'll match lines like
                    //  return "string"
                    const goPkgRegex = /\t\"([\w\/]*)\"$|\t([\w/]*)\s"[\w\/]*"$|import\\s"([\w\/]*)"$/
                    const match = goPkgRegex.exec(line);
                    console.log(match)
                    if (match && match.length >= 1) {
                        const pkgName = match[1]
                        return of({lineNumber, pkgName});
                    }
                    return EMPTY;
                }
            ),
            toArray()
        ).subscribe(matches => {
            if (!matches) {
                return
            }
            if (
                sourcegraph.app.activeWindow &&
                sourcegraph.app.activeWindow.visibleViewComponents.length >
                    0
            ) {
                sourcegraph.app.activeWindow.visibleViewComponents[0].setDecorations(
                    null,
                    matches.map(match => ({
                            range: new sourcegraph.Range(
                                new sourcegraph.Position(match.lineNumber, 0),
                                new sourcegraph.Position(match.lineNumber, 0)
                            ),
                            after: {
                                contentText: 'See all usages',
                                linkURL: '/search?q=go.imports:' + match.pkgName,
                                backgroundColor: 'pink',
                                color: 'black'
                            }
                    })
                );
            }
            });
    });
}

// See https://about.sourcegraph.com/blog/extension-authoring for instructions and examples.
